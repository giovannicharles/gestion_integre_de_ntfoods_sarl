import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComptableService, RapportTelecharge } from '../../../infrastructure/comptable.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

type TypeRapport = 'factures' | 'decaissements' | 'versements' | 'primes';

function lundiCourant(): string {
  const today = new Date();
  const lundi = new Date(today);
  lundi.setDate(today.getDate() - today.getDay() + 1);
  return lundi.toISOString().split('T')[0];
}

function premierDuMois(): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
}

function aujourdHui(): string {
  return new Date().toISOString().split('T')[0];
}

@Component({
  selector: 'app-comptable-rapports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comptable-rapports.component.html',
  styleUrls: ['./comptable-rapports.component.css'],
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
