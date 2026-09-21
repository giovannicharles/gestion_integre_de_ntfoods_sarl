import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, ComparaisonFutsProductionBE } from '../../../../infrastructure/production.service';

/**
 * SUIVI DE PRODUCTION — Agent Doseur
 * Quantité produite/restante, taux d'avancement, progression PPH et fûts,
 * alertes de dépassement et objectifs atteints.
 */
@Component({
  selector: 'app-ad-suivi',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './ad-suivi.component.html',
  styleUrls: ['./ad-suivi.component.css', '../_shared.css']
})
export class AdSuiviComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  message = signal('');
  pphs = signal<PPHBE[]>([]);
  pphSelectionne = signal<PPHBE | null>(null);
  dateComparaison = new Date().toISOString().split('T')[0];
  comparaison = signal<ComparaisonFutsProductionBE | null>(null);

  quantiteProduite = computed(() => {
    const p = this.pphSelectionne();
    return p ? p.lignes.reduce((s, l) => s + l.productionRealisee, 0) : 0;
  });
  quantitePrevue = computed(() => {
    const p = this.pphSelectionne();
    return p ? p.lignes.reduce((s, l) => s + l.objectifSemaine, 0) : 0;
  });
  quantiteRestante = computed(() => Math.max(0, this.quantitePrevue() - this.quantiteProduite()));
  tauxAvancement = computed(() => this.quantitePrevue() > 0 ? Math.round((this.quantiteProduite() / this.quantitePrevue()) * 1000) / 10 : 0);

  alertes = computed(() => {
    const alertes: { type: 'danger' | 'warning' | 'success'; texte: string }[] = [];
    const c = this.comparaison();
    if (c && c.ecartPourcentage < -15) alertes.push({ type: 'danger', texte: `Écart important détecté : production réelle inférieure de ${Math.abs(c.ecartPourcentage)}% à l'attendu` });
    if (c && c.ecartPourcentage > 15) alertes.push({ type: 'warning', texte: `Dépassement détecté : production réelle supérieure de ${c.ecartPourcentage}% à l'attendu` });
    if (this.tauxAvancement() >= 100) alertes.push({ type: 'success', texte: 'Objectif du PPH atteint' });
    return alertes;
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs().subscribe({
      next: list => {
        this.pphs.set(list);
        const enCours = list.find(p => p.statut === 'EN_COURS');
        if (enCours) this.selectionnerPph(enCours);
        this.loading.set(false);
      },
      error: () => { this.message.set('Erreur lors du chargement des PPH'); this.loading.set(false); }
    });
  }

  selectionnerPph(p: PPHBE): void {
    this.pphSelectionne.set(p);
    this.comparaison.set(null);
  }

  comparerFuts(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.svc.getComparaisonFutsProduction(p.referencePPH, this.dateComparaison).subscribe({
      next: c => this.comparaison.set(c),
      error: () => this.message.set('Erreur lors de la comparaison fûts / production')
    });
  }
}
