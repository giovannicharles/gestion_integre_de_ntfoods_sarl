import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService, BonCommandeBE } from '../../../../../stock/infrastructure/stock.service';

/**
 * BONS DE COMMANDE — Agent de Production (consultation)
 *
 * Le Bon de Commande est une entité du module Stock (fournisseur), pas de
 * Production. GET /stock/bons-commande et /stock/bons-commande/{numero} ne
 * sont gardés que par @PreAuthorize("isAuthenticated()") côté backend : tout
 * utilisateur connecté peut déjà les consulter, quel que soit son rôle.
 *
 * En revanche, valider / envoyer / clôturer / annuler un BC exige
 * STOCK_BON_COMMANDE_CREER ou STOCK_BON_COMMANDE_VALIDER, qu'AGENT_PRODUCTION
 * ne détient pas — ces actions restent réservées au Gestionnaire de Stock et
 * au Chef de Production. Cet écran est donc volontairement lecture seule.
 */
@Component({
  selector: 'app-ap-bons-commande',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './ap-bons-commande.component.html',
  styleUrls: ['./ap-bons-commande.component.css', '../_shared.css']
})
export class ApBonsCommandeComponent implements OnInit {
  private readonly svc = inject(StockService);

  loading = signal(true);
  erreur = signal('');
  bcs = signal<BonCommandeBE[]>([]);

  recherche = signal('');
  filtreStatut = signal('');
  bcSelectionne = signal<BonCommandeBE | null>(null);

  readonly statuts = ['BROUILLON', 'VALIDE', 'ENVOYE', 'RECU_PARTIEL', 'RECU_TOTAL', 'CLOTURE', 'ANNULE'];

  bcsFiltres = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    return this.bcs().filter(bc =>
      !r || bc.numero.toLowerCase().includes(r) || (bc.codeFournisseur ?? '').toLowerCase().includes(r) || (bc.nomFournisseur ?? '').toLowerCase().includes(r)
    );
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.erreur.set('');
    this.svc.getBonsCommande({ statut: this.filtreStatut() || undefined }).subscribe({
      next: list => { this.bcs.set(list); this.loading.set(false); },
      error: () => { this.erreur.set('Erreur lors du chargement des bons de commande.'); this.loading.set(false); }
    });
  }

  ouvrirDetail(bc: BonCommandeBE): void { this.bcSelectionne.set(bc); }
  fermerDetail(): void { this.bcSelectionne.set(null); }

  montantTotal(bc: BonCommandeBE): number {
    if (bc.montantTotalHT != null) return bc.montantTotalHT;
    return bc.lignes.reduce((s, l) => s + (l.prixUnitaireHT ?? 0) * l.quantiteCommandee, 0);
  }

  badgeStatut(statut: string): string {
    switch (statut) {
      case 'BROUILLON': return 'badge bg-neutral';
      case 'VALIDE': return 'badge bg-blue';
      case 'ENVOYE': return 'badge bg-orange';
      case 'RECU_PARTIEL': return 'badge bg-yellow';
      case 'RECU_TOTAL': return 'badge bg-success';
      case 'CLOTURE': return 'badge bg-neutral';
      case 'ANNULE': return 'badge bg-red';
      default: return 'badge';
    }
  }
}
