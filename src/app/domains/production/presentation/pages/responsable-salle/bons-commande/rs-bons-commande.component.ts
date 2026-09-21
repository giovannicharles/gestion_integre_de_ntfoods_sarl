import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService, BonCommandeBE } from '../../../../../stock/infrastructure/stock.service';

/**
 * CONSULTATION DES BONS DE COMMANDE — Responsable de Salle
 * Liste les BC avec statut VALIDE. Lecture seule.
 */
@Component({
  selector: 'app-rs-bons-commande',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './rs-bons-commande.component.html',
  styleUrls: ['./rs-bons-commande.component.css', '../_shared.css']
})
export class RsBonsCommandeComponent implements OnInit {
  private readonly stockSvc = inject(StockService);

  loading = signal(true);
  bcs = signal<BonCommandeBE[]>([]);
  recherche = signal('');
  bcSelectionne = signal<BonCommandeBE | null>(null);

  bcsFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    if (!q) return this.bcs();
    return this.bcs().filter(bc =>
      bc.numero.toLowerCase().includes(q) ||
      bc.codeFournisseur.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.stockSvc.getBonsCommande({ statut: 'VALIDE' }).subscribe({
      next: (list: BonCommandeBE[]) => { this.bcs.set(list); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  ouvrirDetail(bc: BonCommandeBE): void { this.bcSelectionne.set(bc); }
  fermerDetail(): void { this.bcSelectionne.set(null); }

  montantTotal(bc: BonCommandeBE): number {
    if (bc.montantTotalHT != null) return bc.montantTotalHT;
    return (bc.lignes || []).reduce((s: number, l: any) => s + (l.prixUnitaireHT ?? 0) * l.quantiteCommandee, 0);
  }
}
