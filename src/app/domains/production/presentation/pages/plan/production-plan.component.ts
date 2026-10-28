import { Component, signal, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, PPHRepartitionJourBE } from '../../../infrastructure/production.service';
import { StockService, BonCommandeBE } from '../../../../stock/infrastructure/stock.service';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-production-plan',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, FormsModule, HasPermissionDirective],
  templateUrl: './production-plan.component.html',
  styleUrls: ['./production-plan.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionPlanComponent implements OnInit {
  today = new Date();
  private readonly prodSvc = inject(ProductionService);
  private readonly stockSvc = inject(StockService);
  private readonly route = inject(ActivatedRoute);

  pph = signal<PPHBE | null>(null);
  pphs = signal<PPHBE[]>([]);
  bcLie = signal<BonCommandeBE | null>(null);
  loading = signal(true);
  message = signal('');

  showCreerPPH = signal(false);
  showModifierLignes = signal(false);
  nouveauPPH = { referencePPH: '', referenceBC: '', semaine: '', dateDebut: '', dateFin: '' };
  nouvellesLignesPPH: { codeProduit: string; nomProduit: string; objectifSemaine: number }[] = [{ codeProduit: '', nomProduit: '', objectifSemaine: 0 }];
  lignesModifiees: { codeProduit: string; nomProduit: string; objectifSemaine: number }[] = [];

  // Recherche PPH liés à un BC (couverture multi-semaines)
  rechercheBC = '';
  filtreDate = '';
  pphsParBC = signal<PPHBE[] | null>(null);

  /** Références BC uniques extraites de tous les PPH chargés */
  bcUniques = computed(() => {
    const refs = this.pphs()
      .map(p => p.referenceBC)
      .filter((r): r is string => r != null && r.trim() !== '');
    return [...new Set(refs)].sort();
  });

  /** Résultats filtrés par date si un filtre est actif */
  pphsParBCFiltres = computed(() => {
    const liste = this.pphsParBC();
    if (!liste) return null;
    if (!this.filtreDate) return liste;
    return liste.filter(p => p.dateDebut && p.dateDebut >= this.filtreDate);
  });

  lignesMP = computed(() => {
    const p = this.pph();
    if (!p || !p.repartitionJours) return [] as { nom: string; quantite: number; unite: string }[];
    const totaux = new Map<string, number>();
    for (const j of p.repartitionJours) {
      for (const b of j.besoinsMatieresPremiere ?? []) {
        totaux.set(b.matierePremiere, (totaux.get(b.matierePremiere) ?? 0) + b.quantiteKg);
      }
    }
    return [...totaux.entries()]
      .filter(([, quantite]) => quantite > 0)
      .map(([nom, quantite]) => ({ nom, quantite: Math.round(quantite * 100) / 100, unite: 'kg' }));
  });

  totalMP = computed(() => this.lignesMP().length);

  quantiteTotaleBC = computed(() => {
    const bc = this.bcLie();
    if (!bc || !bc.lignes) return 0;
    return (bc.lignes || []).reduce((s: number, l: any) => s + (l.quantiteCommandee || 0), 0);
  });

  totalProduitsPlannifies = computed(() => {
    const p = this.pph();
    const bc = this.bcLie();
    if (bc && bc.lignes) return this.quantiteTotaleBC();
    if (!p || !p.lignes) return 0;
    return p.lignes.reduce((s: number, l: any) => s + (l.objectifSemaine || 0), 0);
  });
  totalProduitsRealises = computed(() => {
    const p = this.pph();
    if (!p || !p.lignes) return 0;
    return p.lignes.reduce((s: number, l: any) => s + (l.productionRealisee || 0), 0);
  });

  progressionGlobale = computed(() => {
    const total = this.totalProduitsPlannifies();
    if (total === 0) return 0;
    return Math.round((this.totalProduitsRealises() / total) * 100);
  });

  totalFuts = computed(() => {
    const p = this.pph();
    return p?.repartitionJours?.reduce((s: number, j: any) => s + (j.futsPrevus || 0), 0) ?? 0;
  });

  totalEmballages = computed(() => {
    const p = this.pph();
    return p?.repartitionJours?.reduce((s: number, j) =>
      s + (j.besoinsEmballage ?? []).reduce((t, b) => t + b.quantite, 0), 0) ?? 0;
  });

  getProduitDesignation(code: string): string {
    return code;
  }

  /** Matières premières d'un jour, formatées « Nom: Qté kg » — liste libre, jamais figée sur maïs/soja/arachide. */
  matieresJour(jour: PPHRepartitionJourBE): string {
    const b = jour.besoinsMatieresPremiere ?? [];
    if (!b.length) return '—';
    return b.map(m => `${m.matierePremiere}: ${(Math.round(m.quantiteKg * 100) / 100)} kg`).join(', ');
  }

  /** Composants d'emballage d'un jour, formatés « Type: Qté ». */
  emballagesJour(jour: PPHRepartitionJourBE): string {
    const b = jour.besoinsEmballage ?? [];
    if (!b.length) return '—';
    return b.map(e => `${e.type}: ${e.quantite}`).join(', ');
  }

  totalObjectifsModifies(): number {
    return this.lignesModifiees.reduce((s: number, l: any) => s + (l.objectifSemaine || 0), 0);
  }

  totalRealisePPH(): number {
    return this.pph()?.lignes?.reduce((s: number, l: any) => s + (l.productionRealisee || 0), 0) ?? 0;
  }

  ngOnInit(): void {
    this.prodSvc.getPPHEnCours().subscribe({
      next: p => {
        this.pph.set(p);
        if (p?.referenceBC) {
          this.stockSvc.getBonCommande(p.referenceBC).subscribe({
            next: (bc: BonCommandeBE | null) => this.bcLie.set(bc),
            error: () => this.bcLie.set(null)
          });
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.prodSvc.getPPHs().subscribe({
      next: p => this.pphs.set(p),
      error: () => this.message.set('Impossible de charger la liste des PPH')
    });

    // Si on arrive depuis la validation d'un BC, on cherche immédiatement les PPH liés
    const bc = this.route.snapshot.queryParamMap.get('bc');
    if (bc) {
      this.rechercheBC = bc;
      this.rechercherParBC();
    }
  }

  selectionnerPPH(ref: string): void {
    this.loading.set(true);
    this.bcLie.set(null);
    this.prodSvc.getPPH(ref).subscribe({
      next: p => {
        this.pph.set(p);
        if (p.referenceBC) {
          this.stockSvc.getBonCommande(p.referenceBC).subscribe({
            next: (bc: BonCommandeBE | null) => this.bcLie.set(bc),
            error: () => this.bcLie.set(null)
          });
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  ajouterLignePPH(): void {
    this.nouvellesLignesPPH.push({ codeProduit: '', nomProduit: '', objectifSemaine: 0 });
  }

  retirerLignePPH(index: number): void {
    this.nouvellesLignesPPH.splice(index, 1);
  }

  creerPPH(): void {
    const lignes = this.nouvellesLignesPPH.filter(l => l.codeProduit.trim() && l.objectifSemaine > 0);
    if (!this.nouveauPPH.referencePPH || !this.nouveauPPH.semaine || !this.nouveauPPH.dateDebut ||
        !this.nouveauPPH.dateFin || lignes.length === 0) {
      this.message.set('Référence PPH, semaine, dates et au moins une ligne sont obligatoires');
      return;
    }
    this.prodSvc.creerPPH({ ...this.nouveauPPH, lignes }).subscribe({
      next: p => {
        this.pphs.update(list => [...list, p]);
        this.pph.set(p);
        this.showCreerPPH.set(false);
        this.nouveauPPH = { referencePPH: '', referenceBC: '', semaine: '', dateDebut: '', dateFin: '' };
        this.nouvellesLignesPPH = [{ codeProduit: '', nomProduit: '', objectifSemaine: 0 }];
      },
      error: () => this.message.set('Erreur lors de la création du PPH')
    });
  }

  selectionnerBC(ref: string): void {
    this.rechercheBC = ref;
    this.filtreDate = '';
    this.rechercherParBC();
  }

  rechercherParBC(): void {
    if (!this.rechercheBC.trim()) { this.pphsParBC.set(null); return; }
    this.prodSvc.getPPHParBC(this.rechercheBC.trim()).subscribe({
      next: list => this.pphsParBC.set(list),
      error: () => this.pphsParBC.set([])
    });
  }

  validerPPH(): void {
    const ref = this.pph()?.referencePPH;
    if (!ref) return;
    this.prodSvc.validerPPH(ref).subscribe({
      next: p => this.pph.set(p),
      error: () => this.message.set('Erreur lors de la validation')
    });
  }

  demarrerPPH(): void {
    const ref = this.pph()?.referencePPH;
    if (!ref) return;
    this.prodSvc.demarrerPPH(ref).subscribe({
      next: p => this.pph.set(p),
      error: () => this.message.set('Erreur lors du démarrage')
    });
  }

  cloturerPPH(): void {
    const ref = this.pph()?.referencePPH;
    if (!ref) return;
    this.prodSvc.cloturerPPH(ref).subscribe({
      next: p => this.pph.set(p),
      error: () => this.message.set('Erreur lors de la clôture')
    });
  }

  ouvrirModifierLignes(): void {
    this.lignesModifiees = (this.pph()?.lignes || []).map(l => ({
      codeProduit: l.codeProduit, nomProduit: l.nomProduit, objectifSemaine: l.objectifSemaine
    }));
    this.showModifierLignes.set(true);
  }

  modifierLignes(): void {
    const ref = this.pph()?.referencePPH;
    if (!ref) return;
    this.prodSvc.modifierLignesPPH(ref, this.lignesModifiees).subscribe({
      next: p => { this.pph.set(p); this.showModifierLignes.set(false); },
      error: () => this.message.set('Erreur lors de la modification des lignes')
    });
  }

  progression(realise: number, prevu: number): number {
    if (prevu === 0) return 0;
    return Math.min(Math.round((realise / prevu) * 100), 100);
  }

  progressClass(pct: number): string {
    if (pct >= 100) return 'prog-bar prog-g';
    if (pct >= 60) return 'prog-bar prog-y';
    return 'prog-bar prog-r';
  }

  statutPlanClass(s: string): string {
    const map: Record<string, string> = {
      EN_COURS: 'badge bg-orange',
      CLOTURE: 'badge bg-success',
      VALIDE: 'badge bg-neutral',
      BROUILLON: 'badge bg-neutral',
    };
    return map[s] ?? 'badge bg-neutral';
  }
}
