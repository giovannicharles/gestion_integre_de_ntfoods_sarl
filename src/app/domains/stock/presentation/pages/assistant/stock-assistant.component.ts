import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-stock-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-assistant.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StockAssistantComponent {
  // Calculateur Formule de Wilson (Quantité Économique de Commande)
  consommationAnnuelleCartons = signal<number>(12_000);
  coutLancementCommandeFCFA = signal<number>(25_000);
  coutStockageUnitaireAnFCFA = signal<number>(450);

  // Stock de Sécurité
  delaiFournisseurJours = signal<number>(5);
  consommationJournaliereMoyenne = signal<number>(40);
  ecartTypeDemande = signal<number>(15);

  get quantiteEconomiqueCommande(): number {
    const D = this.consommationAnnuelleCartons();
    const S = this.coutLancementCommandeFCFA();
    const H = this.coutStockageUnitaireAnFCFA();
    if (H <= 0) return 0;
    return Math.round(Math.sqrt((2 * D * S) / H));
  }

  get nombreCommandesAn(): number {
    const q = this.quantiteEconomiqueCommande;
    if (q <= 0) return 0;
    return Math.round((this.consommationAnnuelleCartons() / q) * 10) / 10;
  }

  get pointDeCommandeSeuilAlerte(): number {
    const demandePendantDelai = this.consommationJournaliereMoyenne() * this.delaiFournisseurJours();
    const stockSecurite = Math.round(1.65 * this.ecartTypeDemande() * Math.sqrt(this.delaiFournisseurJours()));
    return demandePendantDelai + stockSecurite;
  }

  get stockSecuriteRecommande(): number {
    return Math.round(1.65 * this.ecartTypeDemande() * Math.sqrt(this.delaiFournisseurJours()));
  }
}
