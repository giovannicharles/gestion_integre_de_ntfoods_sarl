import { Component, signal, computed, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StockService, BonCommandeBE } from '../../../../../stock/infrastructure/stock.service';

type TriBC = 'ancien' | 'recent' | 'montant';

/**
 * VALIDATION DES BONS DE COMMANDE — Chef de Production
 *
 * File des BC en attente (statut BROUILLON). Valider un BC génère aussitôt son
 * plan de production (PPH) côté serveur ; la période de production du BC, si
 * elle est renseignée, borne ce plan.
 */
@Component({
  selector: 'app-cp-validation-bc',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cp-validation-bc.component.html',
  styleUrls: ['./cp-validation-bc.component.css', '../_shared.css']
})
export class CpValidationBcComponent implements OnInit {
  private readonly stockSvc = inject(StockService);

  bcs = signal<BonCommandeBE[]>([]);
  loading = signal(true);
  error = signal('');

  /** Résultat de la dernière validation, affiché sur la page (pas de redirection). */
  dernierValide = signal<BonCommandeBE | null>(null);

  /** BC sélectionné pour la confirmation. */
  bcAValider = signal<BonCommandeBE | null>(null);
  saving = signal(false);
  erreurValidation = signal('');

  recherche = signal('');
  tri = signal<TriBC>('ancien');

  readonly aujourdhui = this.dateLocaleIso(new Date());

  /** Indicateurs de la file. */
  nbEnAttente = computed(() => this.bcs().length);
  montantEnAttente = computed(() => this.bcs().reduce((s, bc) => s + this.montantTotal(bc), 0));
  nbLignesAPlanifier = computed(() => this.bcs().reduce((s, bc) => s + bc.lignes.length, 0));
  nbEnRetard = computed(() => this.bcs().filter(bc => this.estEnRetardAValider(bc)).length);
  plusAncien = computed(() => {
    const dates = this.bcs().map(bc => bc.dateCommande).filter((d): d is string => !!d).sort();
    return dates.length ? this.joursEcoules(dates[0]) : 0;
  });

  /** File affichée : recherche + tri. */
  bcsFiltres = computed(() => {
    const q = this.recherche().toLowerCase().trim();
    const liste = this.bcs().filter(bc =>
      !q ||
      bc.numero.toLowerCase().includes(q) ||
      (bc.nomFournisseur ?? bc.codeFournisseur ?? '').toLowerCase().includes(q) ||
      bc.lignes.some(l => l.codeProduit.toLowerCase().includes(q)));
    const t = this.tri();
    return [...liste].sort((a, b) => {
      if (t === 'montant') return this.montantTotal(b) - this.montantTotal(a);
      const cmp = (a.dateCommande ?? '').localeCompare(b.dateCommande ?? '');
      return t === 'ancien' ? cmp : -cmp;
    });
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    this.stockSvc.getBonsCommande({ statut: 'BROUILLON' }).subscribe({
      next: list => { this.bcs.set(list); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les bons de commande en attente.'); this.loading.set(false); }
    });
  }

  ouvrirConfirmation(bc: BonCommandeBE): void {
    this.erreurValidation.set('');
    this.bcAValider.set(bc);
  }

  annulerConfirmation(): void {
    if (this.saving()) return;
    this.bcAValider.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.annulerConfirmation(); }

  valider(): void {
    const bc = this.bcAValider();
    if (!bc || this.saving()) return;
    this.saving.set(true);
    this.erreurValidation.set('');
    this.stockSvc.validerBonCommande(bc.numero).subscribe({
      next: maj => {
        this.saving.set(false);
        this.bcAValider.set(null);
        this.dernierValide.set(maj);
        this.bcs.update(list => list.filter(b => b.id !== bc.id));
      },
      error: err => {
        this.saving.set(false);
        this.erreurValidation.set(err?.error?.message ?? 'Validation impossible. Vérifiez les poids unitaires et les produits du BC.');
      }
    });
  }

  fermerSucces(): void { this.dernierValide.set(null); }

  // ── Helpers d'affichage ───────────────────────────────────────────────────

  montantTotal(bc: BonCommandeBE): number {
    if (bc.montantTotalHT != null) return bc.montantTotalHT;
    return bc.lignes.reduce((s, l) => s + (l.prixUnitaireHT ?? 0) * l.quantiteCommandee, 0);
  }

  /** Un BC en attente est en retard si la livraison prévue est dépassée sans qu'il ait été validé. */
  estEnRetardAValider(bc: BonCommandeBE): boolean {
    return !!bc.dateLivraisonPrevue && bc.dateLivraisonPrevue < this.aujourdhui;
  }

  libellePeriode(bc: BonCommandeBE): string {
    if (bc.dateDebutProduction && bc.dateFinProduction) {
      return `${this.formatDate(bc.dateDebutProduction)} → ${this.formatDate(bc.dateFinProduction)}`;
    }
    return 'Semaine de commande';
  }

  joursEcoules(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    const debut = Date.UTC(y, m - 1, d);
    const [ty, tm, td] = this.aujourdhui.split('-').map(Number);
    return Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - debut) / 86400000));
  }

  libelleAge(iso: string): string {
    const j = this.joursEcoules(iso);
    if (j === 0) return "Aujourd'hui";
    return j === 1 ? 'Il y a 1 jour' : `Il y a ${j} jours`;
  }

  /** Premiers produits d'un BC, pour l'aperçu de la carte. */
  apercuProduits(bc: BonCommandeBE): { codeProduit: string; quantiteCommandee: number }[] {
    return bc.lignes.slice(0, 3).map(l => ({ codeProduit: l.codeProduit, quantiteCommandee: l.quantiteCommandee }));
  }

  private formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private dateLocaleIso(d: Date): string {
    const mois = String(d.getMonth() + 1).padStart(2, '0');
    const jour = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mois}-${jour}`;
  }
}
