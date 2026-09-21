import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE } from '../../../../infrastructure/production.service';

/**
 * CONSULTATION DES PLANS DE PRODUCTION (PPH) — Agent Doseur
 * Recherche, filtres état/période, quantités prévues, matières premières
 * attendues, nombre de fûts à produire, taux d'avancement.
 */
@Component({
  selector: 'app-ad-plans',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './ad-plans.component.html',
  styleUrls: ['./ad-plans.component.css', '../_shared.css']
})
export class AdPlansComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  error = signal('');
  pphs = signal<PPHBE[]>([]);

  recherche = signal('');
  filtreStatut = signal('');
  filtreDebut = signal('');
  filtreFin = signal('');
  pphSelectionne = signal<PPHBE | null>(null);

  statuts = ['BROUILLON', 'VALIDE', 'EN_COURS', 'CLOTURE'];

  pphsFiltres = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    const statut = this.filtreStatut(); const debut = this.filtreDebut(); const fin = this.filtreFin();
    return this.pphs().filter(p => {
      if (r && !p.referencePPH.toLowerCase().includes(r) && !(p.referenceBC ?? '').toLowerCase().includes(r)) return false;
      if (statut && p.statut !== statut) return false;
      if (debut && p.dateFin < debut) return false;
      if (fin && p.dateDebut > fin) return false;
      return true;
    });
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs().subscribe({
      next: list => { this.pphs.set(list); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors du chargement des PPH'); this.loading.set(false); }
    });
  }

  ouvrirDetail(p: PPHBE): void { this.pphSelectionne.set(p); }
  fermerDetail(): void { this.pphSelectionne.set(null); }

  tauxAvancement(p: PPHBE): number {
    if (!p.lignes.length) return 0;
    const obj = p.lignes.reduce((s, l) => s + l.objectifSemaine, 0);
    const rea = p.lignes.reduce((s, l) => s + l.productionRealisee, 0);
    return obj > 0 ? Math.round((rea / obj) * 1000) / 10 : 0;
  }

  totalFutsPrevus(p: PPHBE): number {
    return p.lignesDetaillees.reduce((s, l) => s + l.futsPrevus, 0);
  }

  statutClass(s: string): string {
    if (s === 'CLOTURE') return 'badge bg-success';
    if (s === 'EN_COURS') return 'badge bg-orange';
    return 'badge bg-neutral';
  }

  reinitialiserFiltres(): void {
    this.recherche.set(''); this.filtreStatut.set(''); this.filtreDebut.set(''); this.filtreFin.set('');
  }
}
