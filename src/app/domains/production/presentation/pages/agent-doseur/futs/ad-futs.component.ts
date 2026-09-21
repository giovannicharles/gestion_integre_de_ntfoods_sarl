import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionDosageBE } from '../../../../infrastructure/production.service';
import { AdSessionContextService } from '../ad-session-context.service';

/**
 * CONDITIONNEMENT DES FÛTS — Agent Doseur
 * Le nombre de fûts sortis correspond au nombre de fûts produits.
 * La sélection de session est déléguée à AdSessionContextService.
 */
@Component({
  selector: 'app-ad-futs',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './ad-futs.component.html',
  styleUrls: ['./ad-futs.component.css', '../_shared.css'],
})
export class AdFutsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  readonly contexte = inject(AdSessionContextService);

  message = signal('');
  erreurAcces = signal(false);
  loading = signal(true);
  historique = signal<SessionDosageBE[]>([]);

  nbProduits = 0;
  today = this.contexte.today;

  /** Fûts nets = fûts produits/sortis. */
  futsNets = computed(() => Math.max(0, this.nbProduits));

  ngOnInit(): void {
    this.contexte.chargerSessionsOuvertes();
    this.chargerHistorique();
  }

  chargerHistorique(): void {
    this.loading.set(true);
    this.erreurAcces.set(false);
    this.svc.getSessionsDosageParPeriode(this.joursAvant(14), this.today).subscribe({
      next: s => { this.historique.set(s); this.loading.set(false); },
      error: () => { this.erreurAcces.set(true); this.loading.set(false); },
    });
  }

  private joursAvant(n: number): string {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0];
  }

  selectionnerSessionDepuisSelect(value: string): void {
    this.contexte.selectionnerParId(value);
  }

  enregistrer(): void {
    const active = this.contexte.sessionActive();
    if (!active || this.nbProduits <= 0) {
      this.message.set('Session ouverte et nombre de fûts produits sont obligatoires');
      return;
    }
    this.svc.enregistrerFutsDosage(active.id, this.nbProduits).subscribe({
      next: s => {
        this.message.set(`Fûts enregistrés — ${s.nbFutsNets} fûts sortis pour la session #${s.id}`);
        this.nbProduits = 0;
        this.chargerHistorique();
        this.contexte.chargerSessionsOuvertes(true);
      },
      error: () => this.message.set("Erreur lors de l'enregistrement des fûts"),
    });
  }
}
