import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StockService, BonCommandeBE } from '../../../../../stock/infrastructure/stock.service';

@Component({
  selector: 'app-cp-validation-bc',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './cp-validation-bc.component.html',
  styleUrls: ['./cp-validation-bc.component.css', '../_shared.css']
})
export class CpValidationBcComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly router = inject(Router);

  bcs = signal<BonCommandeBE[]>([]);
  loading = signal(true);
  error = signal('');
  successMsg = signal('');

  /** BC actuellement sélectionné pour confirmation */
  bcAValider = signal<BonCommandeBE | null>(null);
  saving = signal(false);

  recherche = signal('');

  get bcsFiltres(): BonCommandeBE[] {
    const q = this.recherche().toLowerCase().trim();
    if (!q) return this.bcs();
    return this.bcs().filter(bc =>
      bc.numero.toLowerCase().includes(q) ||
      bc.codeFournisseur.toLowerCase().includes(q)
    );
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    this.stockSvc.getBonsCommande({ statut: 'BROUILLON' }).subscribe({
      next: (list: BonCommandeBE[]) => { this.bcs.set(list); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les bons de commande.'); this.loading.set(false); }
    });
  }

  ouvrirConfirmation(bc: BonCommandeBE): void {
    this.bcAValider.set(bc);
  }

  annulerConfirmation(): void {
    this.bcAValider.set(null);
  }

  valider(): void {
    const bc = this.bcAValider();
    if (!bc) return;
    this.saving.set(true);
    this.stockSvc.validerBonCommande(bc.numero).subscribe({
      next: () => {
        this.saving.set(false);
        this.bcAValider.set(null);
        this.successMsg.set(`BC ${bc.numero} validé — le plan de production a été généré.`);
        setTimeout(() => this.successMsg.set(''), 5000);
        // Recharge la liste (le BC n'est plus BROUILLON)
        this.charger();
        // Navigue vers la page plan avec le numéro de BC pré-rempli
        this.router.navigate(['/production/plan'], { queryParams: { bc: bc.numero } });
      },
      error: (err: any) => {
        this.saving.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Erreur lors de la validation.';
        this.error.set(msg);
      }
    });
  }

  montantTotal(bc: BonCommandeBE): number {
    if (bc.montantTotalHT != null) return bc.montantTotalHT;
    return (bc.lignes || []).reduce((s: number, l: any) => s + (l.prixUnitaireHT ?? 0) * l.quantiteCommandee, 0);
  }
}
