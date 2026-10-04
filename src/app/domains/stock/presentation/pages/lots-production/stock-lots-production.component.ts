import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, LotBE } from '../../../../production/infrastructure/production.service';

/**
 * Écran Stock — « Lots de Production » (2026-10-01, demande explicite du porteur).
 *
 * Volontairement séparé de `ProductionLotsComponent` (module Production) : le Gestionnaire de
 * Stock ne doit JAMAIS être renvoyé dans le tableau de bord / la navigation du module Production
 * — chaque module garde sa propre interface, même quand les deux consultent la même ressource
 * backend. Cet écran réutilise `ProductionService` (simple injectable partagé, pas une frontière
 * de module) pour les mêmes appels déjà autorisés au Gestionnaire de Stock côté API
 * (`PRODUCTION_LOT_VALIDER_STOCK`, `LotController.java`), mais s'affiche entièrement sous le
 * layout Stock.
 *
 * Volontairement SANS la déclaration de lot (réservée au Chef de Production) : seule la
 * consultation et la validation/rejet, le rôle réel du Gestionnaire de Stock dans ce circuit.
 */
@Component({
  selector: 'app-stock-lots-production',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './stock-lots-production.component.html',
  styleUrls: ['./stock-lots-production.component.css'],
})
export class StockLotsProductionComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(false);
  lots = signal<LotBE[]>([]);
  lotsAValider = signal<LotBE[]>([]);
  showRejeter = signal<LotBE | null>(null);
  motifRejet = '';
  message = signal('');

  nbAValider = computed(() => this.lotsAValider().length);
  nbValidesStock = computed(() => this.lots().filter(l => l.statut === 'VALIDATED_BY_STOCK').length);
  nbRejetes = computed(() => this.lots().filter(l => l.statut === 'REJETE').length);
  totalKgDeclares = computed(() => this.lots().reduce((s, l) => s + l.quantiteKg, 0));

  ngOnInit(): void {
    this.chargerLots();
    this.chargerLotsAValider();
  }

  chargerLots(): void {
    this.loading.set(true);
    this.svc.getLots().subscribe({
      next: list => { this.lots.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  chargerLotsAValider(): void {
    this.svc.getLotsAValider().subscribe({
      next: list => this.lotsAValider.set(list),
      error: () => {},
    });
  }

  /** Validation physique par le Gestionnaire de Stock — déclenche le verrouillage de la fiche. */
  validerLot(lot: LotBE): void {
    if (!confirm(`Valider le lot ${lot.numeroLot} et l'intégrer au stock central ?`)) return;
    this.svc.validerLot(lot.numeroLot).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.lotsAValider.update(list => list.filter(x => x.numeroLot !== l.numeroLot));
        this.message.set('Lot validé — fiche de production verrouillée');
      },
      error: () => this.message.set('Erreur lors de la validation du lot'),
    });
  }

  ouvrirRejeter(lot: LotBE): void {
    this.motifRejet = '';
    this.showRejeter.set(lot);
  }

  confirmerRejet(): void {
    const lot = this.showRejeter();
    if (!lot || !this.motifRejet.trim()) return;
    this.svc.rejeterLot(lot.numeroLot, this.motifRejet.trim()).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.lotsAValider.update(list => list.filter(x => x.numeroLot !== l.numeroLot));
        this.showRejeter.set(null);
        this.message.set('Lot rejeté');
      },
      error: () => this.message.set('Erreur lors du rejet du lot'),
    });
  }

  fermerRejeter(): void {
    this.showRejeter.set(null);
  }

  private remplacerLot(l: LotBE): void {
    this.lots.update(list => list.map(x => x.numeroLot === l.numeroLot ? l : x));
  }

  statutClass(s: string): string {
    if (s === 'VALIDATED_BY_STOCK') return 'badge bg-success';
    if (s === 'REJETE') return 'badge bg-red';
    if (s === 'RECEPTIONNE_STOCK') return 'badge bg-neutral';
    return 'badge bg-orange';
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      DECLARE: 'Déclaré Production',
      RECEPTIONNE_STOCK: 'Réceptionné Stock',
      VALIDATED_BY_STOCK: 'Validé Stock',
      REJETE: 'Rejeté',
    };
    return map[s] ?? s;
  }
}
