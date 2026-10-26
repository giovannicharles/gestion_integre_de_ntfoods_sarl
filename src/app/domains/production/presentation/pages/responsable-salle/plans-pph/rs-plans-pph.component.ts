import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, PPHBE, PPHLigneDetailBE } from '../../../../infrastructure/production.service';
import { BesoinsParJourComponent } from '../../../shared/besoins-par-jour/besoins-par-jour.component';

type Statut = 'TOUS' | 'BROUILLON' | 'VALIDE' | 'EN_COURS' | 'CLOTURE';

/** Libellés et teintes des statuts d'un plan. */
const STATUTS: Record<string, { libelle: string; teinte: string }> = {
  BROUILLON: { libelle: 'Brouillon', teinte: 'brouillon' },
  VALIDE: { libelle: 'Validé', teinte: 'valide' },
  EN_COURS: { libelle: 'En cours', teinte: 'encours' },
  CLOTURE: { libelle: 'Clôturé', teinte: 'cloture' },
};

/** Totaux d'un plan, calculés à partir des données qu'il contient. */
export interface ResumePlan {
  nbProduits: number;
  objectif: number;
  realise: number;
  avancement: number | null;
  futs: number;
  matieresKg: number;
  matieres: { nom: string; kg: number }[];
  emballage: { type: string; quantite: number }[];
  nbJours: number;
  produitsSansFormule: string[];
  produitsSansEmballage: string[];
}

/**
 * PLANS DE PRODUCTION — Responsable de Salle.
 * Consultation de tous les plans avec leurs valeurs : objectifs et réalisé, fûts, matières premières et
 * emballage par jour, produits à compléter (sans formule ou sans emballage). Lecture seule : les ajustements
 * se font sur la page dédiée.
 */
@Component({
  selector: 'app-rs-plans-pph',
  standalone: true,
  imports: [BesoinsParJourComponent, CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-plans-pph.component.html',
  styleUrls: ['./rs-plans-pph.component.css'],
})
export class RsPlansPphComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = new Date();
  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);
  readonly plans = signal<PPHBE[]>([]);

  readonly recherche = signal('');
  readonly statut = signal<Statut>('TOUS');
  readonly planSelectionne = signal<PPHBE | null>(null);

  readonly statuts: { code: Statut; libelle: string }[] = [
    { code: 'TOUS', libelle: 'Tous' },
    { code: 'BROUILLON', libelle: 'Brouillons' },
    { code: 'VALIDE', libelle: 'Validés' },
    { code: 'EN_COURS', libelle: 'En cours' },
    { code: 'CLOTURE', libelle: 'Clôturés' },
  ];

  readonly compteurs = computed(() => {
    const liste = this.plans();
    const compte = (s: string) => liste.filter(p => p.statut === s).length;
    return { TOUS: liste.length, BROUILLON: compte('BROUILLON'), VALIDE: compte('VALIDE'), EN_COURS: compte('EN_COURS'), CLOTURE: compte('CLOTURE') };
  });

  readonly plansFiltres = computed(() => {
    const s = this.statut();
    const q = this.recherche().trim().toLowerCase();
    return this.plans()
      .filter(p => s === 'TOUS' || p.statut === s)
      .filter(p => !q
        || p.referencePPH.toLowerCase().includes(q)
        || (p.referenceBC ?? '').toLowerCase().includes(q)
        || p.semaine.toLowerCase().includes(q))
      .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
  });

  /** Totaux de l'ensemble des plans affichés. */
  readonly totaux = computed(() => {
    const rs = this.plansFiltres().map(p => this.resume(p));
    const objectif = rs.reduce((t, r) => t + r.objectif, 0);
    const realise = rs.reduce((t, r) => t + r.realise, 0);
    return {
      objectif, realise,
      avancement: objectif > 0 ? Math.round((realise / objectif) * 1000) / 10 : null,
      futs: rs.reduce((t, r) => t + r.futs, 0),
      matieresKg: rs.reduce((t, r) => t + r.matieresKg, 0),
      aCompleter: this.plansFiltres().filter(p => {
        const r = this.resume(p);
        return r.produitsSansFormule.length > 0 || r.produitsSansEmballage.length > 0;
      }).length,
    };
  });

  readonly resumePlanSelectionne = computed(() => {
    const p = this.planSelectionne();
    return p ? this.resume(p) : null;
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.sessionExpiree.set(false);
    this.svc.getPPHs().subscribe({
      next: list => {
        this.plans.set(list);
        this.derniereMaj.set(new Date());
        this.chargement.set(false);
        const ouvert = this.planSelectionne();
        if (ouvert) this.planSelectionne.set(list.find(p => p.referencePPH === ouvert.referencePPH) ?? null);
      },
      error: (e: unknown) => {
        this.chargement.set(false);
        const err = e as { status?: number; error?: { erreur?: string; message?: string } };
        if (err?.status === 401) {
          this.sessionExpiree.set(true);
          this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
        } else {
          this.erreur.set(err?.error?.erreur || err?.error?.message || 'Les plans de production n\'ont pas pu être chargés.');
        }
      },
    });
  }

  ouvrir(p: PPHBE): void {
    this.planSelectionne.set(p);
  }

  fermer(): void {
    this.planSelectionne.set(null);
  }

  libelleStatut(s: string): string {
    return STATUTS[s]?.libelle ?? s;
  }

  teinte(s: string): string {
    return STATUTS[s]?.teinte ?? 'brouillon';
  }

  /** Avancement d'une ligne de produit, plafonné à 100 %. */
  pctLigne(objectif: number, realise: number): number {
    return objectif > 0 ? Math.min(100, (realise / objectif) * 100) : 0;
  }

  /** Lignes de production regroupées par jour, pour le détail. */
  detailParJour(p: PPHBE): { jour: string; lignes: PPHLigneDetailBE[] }[] {
    const map = new Map<string, PPHLigneDetailBE[]>();
    for (const l of p.lignesDetaillees ?? []) {
      map.set(l.dateJour, [...(map.get(l.dateJour) ?? []), l]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([jour, lignes]) => ({ jour, lignes }));
  }

  /** Calcule les totaux d'un plan à partir de ses lignes, de sa répartition et de son détail. */
  resume(p: PPHBE): ResumePlan {
    const lignes = p.lignes ?? [];
    const objectif = lignes.reduce((t, l) => t + l.objectifSemaine, 0);
    const realise = lignes.reduce((t, l) => t + l.productionRealisee, 0);
    const repartition = p.repartitionJours ?? [];

    const matieres = new Map<string, number>();
    const emballage = new Map<string, number>();
    for (const j of repartition) {
      for (const m of j.besoinsMatieresPremiere ?? []) {
        matieres.set(m.matierePremiere, (matieres.get(m.matierePremiere) ?? 0) + m.quantiteKg);
      }
      for (const e of j.besoinsEmballage ?? []) {
        emballage.set(e.type, (emballage.get(e.type) ?? 0) + e.quantite);
      }
    }

    const detail = p.lignesDetaillees ?? [];
    const sansFormule = [...new Set(detail.filter(d => d.formuleManquante).map(d => d.nomProduit))];
    const sansEmballage = [...new Set(detail.filter(d => d.compositionEmballageManquante).map(d => d.nomProduit))];

    return {
      nbProduits: lignes.length,
      objectif,
      realise,
      avancement: objectif > 0 ? Math.round((realise / objectif) * 1000) / 10 : null,
      futs: repartition.reduce((t, j) => t + (j.futsPrevus ?? 0), 0),
      matieresKg: repartition.reduce((t, j) => t + (j.totalMatieresPremieresKg ?? 0), 0),
      matieres: [...matieres.entries()].map(([nom, kg]) => ({ nom, kg })).sort((a, b) => b.kg - a.kg),
      emballage: [...emballage.entries()].map(([type, quantite]) => ({ type, quantite })).sort((a, b) => b.quantite - a.quantite),
      nbJours: repartition.length,
      produitsSansFormule: sansFormule,
      produitsSansEmballage: sansEmballage,
    };
  }
}
