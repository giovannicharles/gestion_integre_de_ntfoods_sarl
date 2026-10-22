import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComptableService, RapportTelecharge } from '../../../infrastructure/comptable.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

type TypeRapport = 'factures' | 'decaissements' | 'versements' | 'primes';

/** Composition manuelle en heure locale — `toISOString()` convertit en UTC et décale la date avant 01:00 (WAT). */
function dateLocaleIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function lundiCourant(): string {
  const today = new Date();
  // (getDay()+6)%7 : lundi=0 ... dimanche=6 — contrairement à `getDay()-1`, gère
  // correctement le dimanche (getDay()=0 → recule de 6 jours, pas d'avance d'un jour).
  const decalage = (today.getDay() + 6) % 7;
  const lundi = new Date(today);
  lundi.setDate(today.getDate() - decalage);
  return dateLocaleIso(lundi);
}

function premierDuMois(): string {
  const today = new Date();
  return dateLocaleIso(new Date(today.getFullYear(), today.getMonth(), 1));
}

function aujourdHui(): string {
  return dateLocaleIso(new Date());
}

@Component({
  selector: 'app-comptable-rapports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comptable-rapports.component.html',
  styleUrls: ['./comptable-rapports.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComptableRapportsComponent {
  private readonly cptSvc = inject(ComptableService);
  private readonly toast = inject(ToastService);

  debut = signal(premierDuMois());
  fin = signal(aujourdHui());
  semaineDebut = signal(lundiCourant());
  format = signal<'pdf' | 'xlsx' | 'csv'>('xlsx');

  enCours = signal<TypeRapport | null>(null);

  readonly rapports: { type: TypeRapport; titre: string; description: string; icone: string }[] = [
    { type: 'factures', titre: 'Factures', description: 'Factures émises et avoirs sur la période', icone: 'fa-file-invoice' },
    { type: 'decaissements', titre: 'Décaissements', description: 'Sorties de caisse validées sur la période', icone: 'fa-money-bill-transfer' },
    { type: 'versements', titre: 'Versements', description: 'Versements des commerciaux sur la période', icone: 'fa-hand-holding-dollar' },
    { type: 'primes', titre: 'Primes', description: 'Primes commerciales d\'une semaine donnée', icone: 'fa-money-bill-trend-up' },
  ];

  telecharger(type: TypeRapport): void {
    if (this.enCours()) return;
    this.enCours.set(type);

    const appel = type === 'primes'
      ? this.cptSvc.rapportPrimes(this.semaineDebut(), this.format())
      : type === 'factures'
      ? this.cptSvc.rapportFactures(this.debut(), this.fin(), this.format())
      : type === 'decaissements'
      ? this.cptSvc.rapportDecaissements(this.debut(), this.fin(), this.format())
      : this.cptSvc.rapportVersements(this.debut(), this.fin(), this.format());

    appel.subscribe({
      next: (r: RapportTelecharge) => {
        this.enCours.set(null);
        this.declencherTelechargement(r);
        this.toast.success('Rapport téléchargé.');
      },
      error: e => { this.enCours.set(null); this.toast.error(extractApiError(e), 'Téléchargement impossible'); },
    });
  }

  private declencherTelechargement(r: RapportTelecharge): void {
    const url = URL.createObjectURL(r.fichier);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.nomFichier;
    a.click();
    URL.revokeObjectURL(url);
  }
}
