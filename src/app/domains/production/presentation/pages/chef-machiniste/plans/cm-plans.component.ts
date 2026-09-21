import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, SessionBroyageBE } from '../../../../infrastructure/production.service';

/**
 * CONSULTATION DES PLANS DE PRODUCTION — Chef Machiniste
 * Lecture seule : recherche, filtres période/état, quantités prévues,
 * matières premières, objectifs de broyage, dépassements autorisés.
 */
@Component({
  selector: 'app-cm-plans',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './cm-plans.component.html',
  styleUrls: ['./cm-plans.component.css', '../_shared.css']
})
export class CmPlansComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  error = signal('');
  pphs = signal<PPHBE[]>([]);
  sessionsParPph = signal<Record<string, SessionBroyageBE[]>>({});

  recherche = signal('');
  filtreStatut = signal<string>('');
  filtreDebut = signal('');
  filtreFin = signal('');

  pphSelectionne = signal<PPHBE | null>(null);

  statuts = ['BROUILLON', 'VALIDE', 'EN_COURS', 'CLOTURE'];

  pphsFiltres = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    const statut = this.filtreStatut();
    const debut = this.filtreDebut();
    const fin = this.filtreFin();
    return this.pphs().filter(p => {
      if (r && !p.referencePPH.toLowerCase().includes(r) && !(p.referenceBC ?? '').toLowerCase().includes(r)) return false;
      if (statut && p.statut !== statut) return false;
      if (debut && p.dateFin < debut) return false;
      if (fin && p.dateDebut > fin) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs().subscribe({
      next: list => { this.pphs.set(list); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors du chargement des PPH'); this.loading.set(false); }
    });
  }

  ouvrirDetail(pph: PPHBE): void {
    this.pphSelectionne.set(pph);
    if (!this.sessionsParPph()[pph.referencePPH]) {
      this.svc.getSessionsBroyage({ referencePPH: pph.referencePPH }).subscribe({
        next: sessions => this.sessionsParPph.update(m => ({ ...m, [pph.referencePPH]: sessions })),
        error: () => this.sessionsParPph.update(m => ({ ...m, [pph.referencePPH]: [] }))
      });
    }
  }

  fermerDetail(): void {
    this.pphSelectionne.set(null);
  }

  sessionsDuPph(referencePPH: string): SessionBroyageBE[] {
    return this.sessionsParPph()[referencePPH] ?? [];
  }

  statutClass(s: string): string {
    if (s === 'CLOTURE') return 'badge bg-success';
    if (s === 'EN_COURS') return 'badge bg-orange';
    if (s === 'VALIDE') return 'badge bg-neutral';
    return 'badge bg-neutral';
  }

  reinitialiserFiltres(): void {
    this.recherche.set('');
    this.filtreStatut.set('');
    this.filtreDebut.set('');
    this.filtreFin.set('');
  }
}
