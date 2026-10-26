import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { forkJoin, of, catchError, map } from 'rxjs';
import {
  ProductionService, ClassementMachinisteBE, ClassementExecuteurBE, RapportHebdoAffectationBE,
  RapportHebdomadaireProductionBE, LotBE, PPHBE, OFBE
} from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

type Periode = 'semaine' | 'semaine-passee' | '30j';

/** Seuils au-delà desquels un point est signalé à l'attention du chef de production. */
const SEUIL_EFFICACITE = 80;
const SEUIL_PERTES = 5;

/** Date au format yyyy-mm-dd en heure locale. */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lundi de la semaine de la date donnée. */
function lundiDe(d: Date): Date {
  const copie = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jour = copie.getDay();
  copie.setDate(copie.getDate() - (jour === 0 ? 6 : jour - 1));
  return copie;
}

/** Résultat d'une source : donnée, ou message d'erreur. */
interface Source<T> { donnee?: T; erreur?: string }

/**
 * PERFORMANCES DE LA PRODUCTION — Chef de Production.
 * Vue d'ensemble de toute la production sur une période : volumes, pertes, équipes,
 * atteinte des objectifs par produit, qualité des lots et respect des échéances.
 */
@Component({
  selector: 'app-cp-performances',
  standalone: true,
  imports: [CommonModule, DatePipe, MiniChartComponent],
  templateUrl: './cp-performances.component.html',
  styleUrls: ['./cp-performances.component.css']
})
export class CpPerformancesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = formaterDate(new Date());
  readonly seuilEfficacite = SEUIL_EFFICACITE;
  readonly seuilPertes = SEUIL_PERTES;

  // ── Période ──
  periode = signal<Periode>('semaine');
  debut = signal(formaterDate(lundiDe(new Date())));
  fin = signal(this.aujourdhui);

  readonly periodes: { code: Periode; libelle: string }[] = [
    { code: 'semaine', libelle: 'Cette semaine' },
    { code: 'semaine-passee', libelle: 'Semaine passée' },
    { code: '30j', libelle: '30 derniers jours' },
  ];

  choisirPeriode(p: Periode): void {
    const maintenant = new Date();
    const lundi = lundiDe(maintenant);
    if (p === 'semaine') {
      this.debut.set(formaterDate(lundi));
      this.fin.set(this.aujourdhui);
    } else if (p === 'semaine-passee') {
      const debutPasse = new Date(lundi); debutPasse.setDate(debutPasse.getDate() - 7);
      const finPasse = new Date(lundi); finPasse.setDate(finPasse.getDate() - 1);
      this.debut.set(formaterDate(debutPasse));
      this.fin.set(formaterDate(finPasse));
    } else {
      const debut30 = new Date(maintenant); debut30.setDate(debut30.getDate() - 29);
      this.debut.set(formaterDate(debut30));
      this.fin.set(this.aujourdhui);
    }
    this.periode.set(p);
    this.charger();
  }

  // ── Chargement par source ──
  enAttente = signal(0);
  chargement = computed(() => this.enAttente() > 0);
  derniereMaj = signal<Date | null>(null);
  erreurs = signal<Record<string, string>>({});
  nbErreurs = computed(() => Object.keys(this.erreurs()).length);
  private requete = 0;

  machinistes = signal<ClassementMachinisteBE | null>(null);
  executeurs = signal<ClassementExecuteurBE[]>([]);
  rapportAffectation = signal<RapportHebdoAffectationBE | null>(null);
  rapportProduction = signal<RapportHebdomadaireProductionBE | null>(null);
  lots = signal<LotBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  ofs = signal<OFBE[]>([]);

  ngOnInit(): void { this.charger(); }

  charger(): void {
    const id = ++this.requete;
    const debut = this.debut();
    const fin = this.fin();
    this.enAttente.set(7);
    this.erreurs.set({});

    const msg = (e: any) => e?.error?.erreur || e?.error?.message || 'Chargement impossible.';
    const garde = <T>(obs: import('rxjs').Observable<T>) =>
      obs.pipe(map(donnee => ({ donnee }) as Source<T>), catchError(e => of({ erreur: msg(e) } as Source<T>)));

    forkJoin({
      machinistes: garde(this.svc.getClassementMachinistes(debut, fin)),
      executeurs: garde(this.svc.getClassementExecuteurs(debut, fin)),
      affectation: garde(this.svc.getRapportHebdomadaireAffectation(debut, fin)),
      production: garde(this.svc.getRapportHebdomadaireProduction(debut, fin)),
      lots: garde(this.svc.getLots()),
      pphs: garde(this.svc.getPPHs()),
      ofs: garde(this.svc.getOFs()),
    }).subscribe(res => {
      if (id !== this.requete) return;
      const erreurs: Record<string, string> = {};
      const ecrire = <T>(nom: string, s: Source<T>, poser: (v: T) => void, vide: T) => {
        if (s.erreur) { erreurs[nom] = s.erreur; poser(vide); } else poser(s.donnee as T);
      };
      ecrire('machinistes', res.machinistes, v => this.machinistes.set(v), null);
      ecrire('executeurs', res.executeurs, v => this.executeurs.set(v), []);
      ecrire('affectation', res.affectation, v => this.rapportAffectation.set(v), null);
      ecrire('production', res.production, v => this.rapportProduction.set(v), null);
      ecrire('lots', res.lots, v => this.lots.set(v), []);
      ecrire('pphs', res.pphs, v => this.pphs.set(v), []);
      ecrire('ofs', res.ofs, v => this.ofs.set(v), []);
      this.erreurs.set(erreurs);
      this.enAttente.set(0);
      this.derniereMaj.set(new Date());
    });
  }

  // ── Indicateurs globaux ──
  /** Moyenne d'efficacité des machinistes, pondérée par leur nombre. */
  efficaciteMoyenne = computed(() => {
    const c = this.machinistes()?.classements ?? [];
    return c.length ? c.reduce((s, x) => s + x.efficacite, 0) / c.length : 0;
  });

  tauxPostesMoyen = computed(() => {
    const c = this.executeurs();
    return c.length ? c.reduce((s, x) => s + x.tauxRealisationMoyen, 0) / c.length : 0;
  });

  lotsDansPeriode = computed(() => this.lots().filter(l => l.dateProduction >= this.debut() && l.dateProduction <= this.fin()));

  tauxValidation = computed(() => {
    const decides = this.lotsDansPeriode().filter(l => l.statut === 'VALIDATED_BY_STOCK' || l.statut === 'REJETE');
    if (!decides.length) return null;
    return (decides.filter(l => l.statut === 'VALIDATED_BY_STOCK').length / decides.length) * 100;
  });

  ofsEnRetard = computed(() => {
    const aujourd = this.aujourdhui;
    return this.ofs().filter(o => o.statut !== 'HONORE' && o.statut !== 'ANNULE' && !!o.dateButoir && o.dateButoir < aujourd);
  });

  tauxRespectEcheances = computed(() => {
    const termines = this.ofs().filter(o => o.statut === 'HONORE');
    if (!termines.length) return null;
    return ((termines.length - termines.filter(o => o.qteRealisee < o.qteDemandee).length) / termines.length) * 100;
  });

  // ── Tendance quotidienne (fûts et production réelle) ──
  tendance = computed(() => {
    const jours = new Map<string, { production: number; futs: number }>();
    for (const c of this.rapportAffectation()?.comparaisonsJournalieres ?? []) {
      const j = jours.get(c.date) ?? { production: 0, futs: 0 };
      j.production += c.productionReelleKg;
      j.futs += c.nbFutsNets;
      jours.set(c.date, j);
    }
    const dates = [...jours.keys()].sort();
    return {
      labels: dates.map(d => d.slice(8, 10) + '/' + d.slice(5, 7)),
      production: dates.map(d => Math.round(jours.get(d)!.production * 10) / 10),
      futs: dates.map(d => jours.get(d)!.futs),
    };
  });

  serieTendance: () => ChartSeries[] = () => [
    { name: 'Production réelle (kg)', color: 'var(--g-l, #2A9D5F)', values: this.tendance().production },
  ];

  serieFuts: () => ChartSeries[] = () => [
    { name: 'Fûts nets', color: 'var(--y, #F6B60B)', values: this.tendance().futs },
  ];

  // ── Équipes ──
  labelsMachinistes = () => (this.machinistes()?.classements ?? []).map(c => c.nomMachiniste);
  serieMachinistes: () => ChartSeries[] = () => [
    { name: 'Efficacité (%)', color: 'var(--g-l, #2A9D5F)', values: (this.machinistes()?.classements ?? []).map(c => c.efficacite) },
  ];

  labelsExecuteurs = () => this.executeurs().map(c => c.nomEmploye);
  serieExecuteurs: () => ChartSeries[] = () => [
    { name: 'Taux de réalisation (%)', color: 'var(--y, #F6B60B)', values: this.executeurs().map(c => c.tauxRealisationMoyen) },
  ];

  // ── Atteinte des objectifs par produit (PPH de la période) ──
  /** Pour chaque produit : unités prévues dans les PPH de la période et unités réalisées. */
  produits = computed(() => {
    const cumul = new Map<string, { code: string; nom: string; prevu: number; realise: number }>();
    for (const p of this.pphs()) {
      if (p.dateFin < this.debut() || p.dateDebut > this.fin()) continue;
      for (const l of p.lignes) {
        const c = cumul.get(l.codeProduit) ?? { code: l.codeProduit, nom: l.nomProduit, prevu: 0, realise: 0 };
        c.prevu += l.objectifSemaine;
        c.realise += l.productionRealisee;
        cumul.set(l.codeProduit, c);
      }
    }
    return [...cumul.values()]
      .filter(c => c.prevu > 0)
      .map(c => ({ ...c, taux: Math.min(100, (c.realise / c.prevu) * 100) }))
      .sort((a, b) => a.taux - b.taux);
  });

  tauxAtteinteGlobal = computed(() => {
    const prevu = this.produits().reduce((s, p) => s + p.prevu, 0);
    const realise = this.produits().reduce((s, p) => s + Math.min(p.realise, p.prevu), 0);
    return prevu > 0 ? (realise / prevu) * 100 : null;
  });

  // ── Points d'attention ──
  alertes = computed<{ niveau: 'haut' | 'moyen'; texte: string }[]>(() => {
    const a: { niveau: 'haut' | 'moyen'; texte: string }[] = [];
    for (const c of this.machinistes()?.classements ?? []) {
      if (c.efficacite < SEUIL_EFFICACITE) a.push({ niveau: 'moyen', texte: `Machiniste ${c.nomMachiniste} : efficacité de ${this.pct(c.efficacite)}` });
    }
    for (const e of this.executeurs()) {
      if (e.tauxRealisationMoyen < SEUIL_EFFICACITE) a.push({ niveau: 'moyen', texte: `${e.nomEmploye} : réalisation de ${this.pct(e.tauxRealisationMoyen)} au poste` });
    }
    const pertes = this.rapportProduction()?.tauxPertesGlobal ?? 0;
    if (pertes > SEUIL_PERTES) a.push({ niveau: 'haut', texte: `Pertes de broyage à ${this.pct(pertes)}, au-dessus du seuil de ${SEUIL_PERTES} %` });
    const rejetes = this.lotsDansPeriode().filter(l => l.statut === 'REJETE');
    if (rejetes.length) a.push({ niveau: 'haut', texte: `${rejetes.length} lot(s) rejeté(s) par le stock sur la période` });
    if (this.ofsEnRetard().length) a.push({ niveau: 'haut', texte: `${this.ofsEnRetard().length} ordre(s) de fabrication en retard` });
    for (const p of this.produits()) {
      if (p.taux < SEUIL_EFFICACITE) a.push({ niveau: 'moyen', texte: `${p.nom} : ${this.pct(p.taux)} de l'objectif atteint` });
    }
    return a.sort((x, y) => (x.niveau === y.niveau ? 0 : x.niveau === 'haut' ? -1 : 1));
  });

  // ── Affichage ──
  formaterKg(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
  }

  pct(v: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} %`;
  }

  couleurTaux(v: number): string {
    return v >= 100 ? 'ok' : v >= SEUIL_EFFICACITE ? 'moyen' : 'bas';
  }

  /** Lots de la période ayant ce statut (les templates Angular 18 n'acceptent pas de fonctions fléchées). */
  lotsStatut(statut: string) { return this.lotsDansPeriode().filter(l => l.statut === statut); }
  nbLotsStatut(statut: string): number { return this.lotsStatut(statut).length; }
}
