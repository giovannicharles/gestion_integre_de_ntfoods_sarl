import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StockService, BonCommandeBE } from '../../../../../stock/infrastructure/stock.service';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';
import { InternalOrderUseCase } from '../../../../../stock/application/use-cases/orders/internal-order.use-case';
import { InternalOrder } from '../../../../../stock/domain/models';
import { AuthService } from '../../../../../../core/auth/auth.service';

@Component({
  selector: 'app-cp-validation-bc',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, HasPermissionDirective],
  templateUrl: './cp-validation-bc.component.html',
  styleUrls: ['./cp-validation-bc.component.css', '../_shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CpValidationBcComponent implements OnInit {
  private readonly stockSvc = inject(StockService);
  private readonly router = inject(Router);
  private readonly orderUC = inject(InternalOrderUseCase);
  private readonly auth = inject(AuthService);

  bcs = signal<BonCommandeBE[]>([]);
  loading = signal(true);
  error = signal('');
  successMsg = signal('');

  /**
   * Commandes internes Stock -> Production (2026-11-03, signalé par le porteur : "quand le
   * stock passe une commande de production, la production doit recevoir"). Système distinct
   * des bons de commande ci-dessus (InternalOrderController, pas BonCommandeController) :
   * le Gestionnaire de Stock crée ces commandes depuis /stock/commande-production, mais
   * jusqu'ici rien côté Production ne les affichait - le Chef de Production ne pouvait ni
   * les voir ni les approuver malgré le circuit documenté "Gestionnaire crée -> Chef de
   * Production approuve". Seul l'état DRAFT (en attente d'approbation) est montré ici ;
   * l'annulation et la livraison restent réservées au Gestionnaire sur son propre écran.
   */
  commandesInternes = signal<InternalOrder[]>([]);
  commandesInternesLoading = signal(true);
  commandeInterneAApprouver = signal<InternalOrder | null>(null);
  approvingInterne = signal(false);

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
    this.chargerCommandesInternes();
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    this.stockSvc.getBonsCommande({ statut: 'BROUILLON' }).subscribe({
      next: (list: BonCommandeBE[]) => { this.bcs.set(list); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les bons de commande.'); this.loading.set(false); }
    });
  }

  chargerCommandesInternes(): void {
    this.commandesInternesLoading.set(true);
    this.orderUC.getActive().subscribe({
      next: (list) => {
        this.commandesInternes.set(list.filter(o => o.status === 'DRAFT'));
        this.commandesInternesLoading.set(false);
      },
      error: () => { this.commandesInternesLoading.set(false); }
    });
  }

  ouvrirApprobationInterne(o: InternalOrder): void {
    this.commandeInterneAApprouver.set(o);
  }

  annulerApprobationInterne(): void {
    this.commandeInterneAApprouver.set(null);
  }

  approuverCommandeInterne(): void {
    const o = this.commandeInterneAApprouver();
    if (!o || this.approvingInterne()) return;
    const user = this.auth.getCurrentUser();
    if (!user) { this.error.set('Session expirée.'); return; }
    this.approvingInterne.set(true);
    this.orderUC.approve(o.id, user.matricule, `${user.firstname} ${user.lastname}`).subscribe({
      next: () => {
        this.approvingInterne.set(false);
        this.commandeInterneAApprouver.set(null);
        this.successMsg.set(`Commande ${o.orderNumber} approuvée.`);
        setTimeout(() => this.successMsg.set(''), 5000);
        this.chargerCommandesInternes();
      },
      error: (err: any) => {
        this.approvingInterne.set(false);
        this.error.set(err?.error?.message ?? err?.message ?? 'Erreur lors de l\'approbation.');
      }
    });
  }

  montantInterneTotal(o: InternalOrder): number {
    return (o.items || []).reduce((s, i) => s + i.requestedQty, 0);
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
        this.successMsg.set(`BC ${bc.numero} validé, le plan de production a été généré.`);
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
