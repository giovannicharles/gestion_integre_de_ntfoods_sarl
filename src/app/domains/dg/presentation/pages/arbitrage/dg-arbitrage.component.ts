import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { DgService, ValidationEnAttenteBE } from '../../../infrastructure/dg.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

/**
 * Route de chaque catégorie vers l'écran du module où la validation RÉELLE a
 * lieu — /dg/validations/{ref}/resoudre ne fait que masquer l'élément de
 * cette vue transversale (voir ResoudreValidationDgUseCase, backend) sans
 * jamais approuver/rejeter la précommande, dotation, BC, réception ou
 * versement sous-jacent. Cet écran est donc un tableau de suivi, pas un
 * circuit d'approbation : la décision réelle se prend dans le module listé.
 */
const ROUTE_PAR_TYPE: Record<string, string> = {
  PRECOMMANDE_SECRETAIRE: '/commercial/precommandes',
  PRECOMMANDE_COMPTABLE: '/commercial/precommandes',
  DOTATION: '/stock/dotations',
  BON_COMMANDE: '/comptable/commandes',
  RECEPTION_ETAPE1: '/stock/reception',
  RECEPTION_ETAPE2: '/stock/reception',
  VERSEMENT: '/comptable/sessions',
};

const LIBELLE_PAR_TYPE: Record<string, string> = {
  PRECOMMANDE_SECRETAIRE: 'Précommande — validation secrétaire',
  PRECOMMANDE_COMPTABLE: 'Précommande — validation comptable',
  DOTATION: 'Dotation commercial',
  BON_COMMANDE: 'Bon de commande',
  RECEPTION_ETAPE1: 'Réception — constat physique',
  RECEPTION_ETAPE2: 'Réception — 2ᵉ validation',
  VERSEMENT: 'Versement',
};

@Component({
  selector: 'app-dg-arbitrage',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './dg-arbitrage.component.html',
  styleUrls: ['./dg-arbitrage.component.css']
})
export class DgArbitrageComponent implements OnInit {
  today = new Date();
  private readonly dgSvc = inject(DgService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  loading = signal(true);
  loadError = signal<string | null>(null);
  validations = signal<ValidationEnAttenteBE[]>([]);
  filterType = signal<string>('all');
  enTraitement = signal<Set<string>>(new Set());

  typesPresents = computed(() => {
    const set = new Set(this.validations().map(v => v.type));
    return Array.from(set);
  });

  demandes = computed(() => {
    const f = this.filterType();
    return f === 'all' ? this.validations() : this.validations().filter(a => a.type === f);
  });

  libelleType = (type: string) => LIBELLE_PAR_TYPE[type] ?? type;
  routeType = (type: string) => ROUTE_PAR_TYPE[type];
  enCours = (ref: string) => this.enTraitement().has(ref);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.dgSvc.getValidationsEnAttente().subscribe({
      next: v => { this.validations.set(v); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  ouvrirModule(item: ValidationEnAttenteBE): void {
    const route = this.routeType(item.type);
    if (route) this.router.navigateByUrl(route);
  }

  /**
   * Retire l'élément de CETTE vue de suivi DG uniquement — n'approuve ni ne
   * rejette rien dans le module concerné (voir commentaire d'en-tête).
   */
  marquerCommeSuivi(item: ValidationEnAttenteBE, problematique: boolean): void {
    if (this.enCours(item.reference)) return;
    this.enTraitement.update(s => new Set(s).add(item.reference));
    this.dgSvc.resoudreValidation(item.reference, item.type, !problematique).subscribe({
      next: () => {
        this.validations.update(list => list.filter(a => a.reference !== item.reference));
        this.enTraitement.update(s => { const n = new Set(s); n.delete(item.reference); return n; });
        this.toast.success('Retiré de votre vue de suivi. La décision réelle reste à prendre dans ' + (LIBELLE_PAR_TYPE[item.type] ?? 'le module concerné') + '.');
      },
      error: e => {
        this.enTraitement.update(s => { const n = new Set(s); n.delete(item.reference); return n; });
        this.toast.error(extractApiError(e), 'Action impossible');
      },
    });
  }
}
