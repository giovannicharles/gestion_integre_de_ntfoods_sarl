import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { ProductionService, SessionBroyageBE, ApercuBroyageBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../../shared/charts/donut-chart.component';

/** Couleur et libellé d'une poudre, identiques partout dans la vue d'ensemble. */
const COULEUR_POUDRE: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
const LIBELLE_POUDRE: Record<string, string> = { MAIS: 'Maïs', SOJA: 'Soja', ARACHIDE: 'Arachide' };

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

/** Une semaine civile (lundi → dimanche) et ses sessions. `sessions` est null si la semaine n'a pas pu être chargée. */
interface Semaine {
  debut: string;
  fin: string;
  libelle: string;
  sessions: SessionBroyageBE[] | null;
}

/** Indicateurs d'un ensemble de sessions. Production = réalisé (somme des machinistes), comme le backend. */
interface Indicateurs {
  production: number;
  objectif: number;
  taux: number | null;
  pertes: number;
  pctPertes: number | null;
  sessions: number;
  parType: Record<string, number>;
}

/**
 * STATISTIQUES — Chef Machiniste.
 *
 * Comparaisons à périodes équivalentes : la semaine en cours est comparée aux mêmes jours de la semaine
 * précédente ; le mois en cours aux mêmes jours du mois précédent. Évolution sur 8 semaines civiles.
 *
 * Définitions : production = réalisé des machinistes ; taux = production ÷ objectif journalier ;
 * % de pertes = pertes ÷ (nette + pertes) sur les sessions où les pertes sont renseignées.
 * Une période sans objectif affiche « — » plutôt qu'une variation inventée.
 */
@Component({
  selector: 'app-cm-statistiques',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink, MiniChartComponent, DonutChartComponent],
  templateUrl: './cm-statistiques.component.html',
  styleUrls: ['./cm-statistiques.component.css'],
})
export class CmStatistiquesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);

  /** Vue d'ensemble des 30 derniers jours : même source que le tableau de bord. */
  readonly apercu = signal<ApercuBroyageBE | null>(null);
  readonly apercuErreur = signal(false);
  readonly jours30 = computed(() => this.apercu()?.jours ?? []);
  readonly labels30 = computed(() => this.jours30().map(j => j.date.slice(8, 10) + '/' + j.date.slice(5, 7)));
  readonly serieObjectifRealise30 = computed<ChartSeries[]>(() => [
    { name: 'Objectif (kg)', color: '#0284c7', values: this.jours30().map(j => j.objectif) },
    { name: 'Réalisé (kg)', color: '#2e7d32', values: this.jours30().map(j => j.realise) },
  ]);
  readonly serieTaux30 = computed<ChartSeries[]>(() => [{
    name: 'Taux (%)', color: '#1E7A42', values: this.jours30().map(j => j.taux ?? 0),
  }]);
  readonly serieNettePertes30 = computed<ChartSeries[]>(() => [
    { name: 'Nette (kg)', color: '#1E7A42', values: this.jours30().map(j => j.nette) },
    { name: 'Pertes (kg)', color: '#d32f2f', values: this.jours30().map(j => j.pertes) },
  ]);
  readonly seriePctPertes30 = computed<ChartSeries[]>(() => [{
    name: '% de pertes', color: '#d32f2f', values: this.jours30().map(j => j.pctPertes ?? 0),
  }]);
  readonly donutPoudres30 = computed<DonutSlice[]>(() => (this.apercu()?.poudres ?? [])
    .filter(p => p.realise > 0)
    .map(p => ({ label: LIBELLE_POUDRE[p.code] ?? p.code, value: Math.round(p.realise * 10) / 10, color: COULEUR_POUDRE[p.code] ?? '#90a4ae' })));
  readonly donutValidation30 = computed<DonutSlice[]>(() => {
    const p = this.apercu()?.periode;
    if (!p) return [];
    return [
      { label: 'Journées validées', value: p.nbValidees, color: '#2e7d32' },
      { label: 'Non validées', value: Math.max(0, p.nbSessions - p.nbValidees), color: '#F6B60B' },
    ].filter(s => s.value > 0);
  });
  readonly semainesEnErreur = signal(0);

  readonly semaines = signal<Semaine[]>([]);
  readonly mois = signal<{ courant: SessionBroyageBE[] | null; precedent: SessionBroyageBE[] | null }>({ courant: null, precedent: null });

  readonly libellesTypes = ['MAIS', 'SOJA', 'ARACHIDE'];
  readonly couleursTypes: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };

  // ── Comparaisons ──
  readonly semaineCourante = computed(() => this.semaines()[this.semaines().length - 1]?.sessions ?? null);
  /** Semaine précédente, limitée aux mêmes jours de semaine que la semaine en cours. */
  readonly semainePrecedente = computed(() => {
    const prec = this.semaines()[this.semaines().length - 2]?.sessions;
    if (!prec) return null;
    const limite = ajouterJours(this.aujourdhui, -7);
    return prec.filter(s => s.date <= limite);
  });
  readonly comparaisonSemaine = computed(() => this.comparer(this.semaineCourante(), this.semainePrecedente()));

  readonly comparaisonMois = computed(() => this.comparer(this.mois().courant, this.mois().precedent));

  readonly libelleMoisPrecedent = computed(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  });

  // ── Tendance 8 semaines ──
  readonly labels = computed(() => this.semaines().map(s => s.libelle));
  readonly indicateursParSemaine = computed(() => this.semaines().map(s => this.indicateurs(s.sessions)));

  readonly serieProduction = computed<ChartSeries[]>(() => [{
    name: 'Production réalisée (kg)', color: '#1E7A42',
    values: this.indicateursParSemaine().map(i => i?.production ?? 0),
  }]);

  readonly serieObjectifsRealise = computed<ChartSeries[]>(() => [
    { name: 'Objectif (kg)', color: '#0284c7', values: this.indicateursParSemaine().map(i => i?.objectif ?? 0) },
    { name: 'Réalisé (kg)', color: '#2e7d32', values: this.indicateursParSemaine().map(i => i?.production ?? 0) },
  ]);

  readonly serieTaux = computed<ChartSeries[]>(() => [{
    name: 'Taux de réalisation (%)', color: '#2e7d32',
    values: this.indicateursParSemaine().map(i => i?.taux ?? 0),
  }]);

  readonly seriePertes = computed<ChartSeries[]>(() => [{
    name: '% de pertes', color: '#d32f2f',
    values: this.indicateursParSemaine().map(i => i?.pctPertes ?? 0),
  }]);

  readonly serieParType = computed<ChartSeries[]>(() => this.libellesTypes.map(type => ({
    name: type, color: this.couleursTypes[type],
    values: this.indicateursParSemaine().map(i => i?.parType[type] ?? 0),
  })));

  /** Récapitulatif des 8 semaines, de la plus récente à la plus ancienne. */
  readonly recapitulatif = computed(() =>
    this.semaines().map((s, i) => ({ ...s, ind: this.indicateursParSemaine()[i] })).reverse());

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    const fin = this.aujourdhui;
    this.svc.getApercuBroyage(ajouterJours(fin, -29), fin).subscribe({
      next: a => { this.apercu.set(a); this.apercuErreur.set(false); },
      error: () => { this.apercu.set(null); this.apercuErreur.set(true); },
    });
    this.erreur.set('');
    this.sessionExpiree.set(false);
    const semaines = this.huitSemaines();
    const requetesSemaines = semaines.map(s => this.tolerer(this.svc.getSessionsBroyage({ debut: s.debut, fin: s.fin })));
    const debutMois = dateLocaleIso(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const debutMoisPrec = dateLocaleIso(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
    const finMoisPrec = ajouterJours(debutMoisPrec, Math.min(new Date().getDate(), this.joursDansMoisPrecedent()) - 1);

    forkJoin({
      semaines: forkJoin(requetesSemaines),
      courant: this.tolerer(this.svc.getSessionsBroyage({ debut: debutMois, fin: this.aujourdhui })),
      precedent: this.tolerer(this.svc.getSessionsBroyage({ debut: debutMoisPrec, fin: finMoisPrec })),
    }).subscribe(r => {
      this.semaines.set(semaines.map((s, i) => ({ ...s, sessions: r.semaines[i] })));
      this.mois.set({ courant: r.courant, precedent: r.precedent });
      this.semainesEnErreur.set(r.semaines.filter(x => x === null).length);
      this.derniereMaj.set(new Date());
      this.chargement.set(false);
    });
  }

  /** Une requête en échec devient « non chargée » (null) sans bloquer les autres. */
  private tolerer(source: Observable<SessionBroyageBE[]>): Observable<SessionBroyageBE[] | null> {
    return source.pipe(catchError((e: unknown) => {
      const err = e as { status?: number };
      if (err?.status === 401) this.sessionExpiree.set(true);
      return of(null);
    }));
  }

  private indicateurs(sessions: SessionBroyageBE[] | null): Indicateurs | null {
    if (!sessions) return null;
    const production = sessions.reduce((t, s) => t + s.totalRealiseKg, 0);
    const objectif = sessions.reduce((t, s) => t + s.objectifJournalierKg, 0);
    const pertes = sessions.reduce((t, s) => t + (s.pertesKg ?? 0), 0);
    const netteAvecPertes = sessions.filter(s => s.pertesKg != null).reduce((t, s) => t + (s.quantiteNetteBroyeeKg ?? 0), 0);
    const brut = netteAvecPertes + pertes;
    const parType: Record<string, number> = {};
    for (const s of sessions) parType[s.typePoudre] = (parType[s.typePoudre] ?? 0) + s.totalRealiseKg;
    return {
      production,
      objectif,
      taux: objectif > 0 ? Math.round((production / objectif) * 1000) / 10 : null,
      pertes,
      pctPertes: brut > 0 ? Math.round((pertes / brut) * 1000) / 10 : null,
      sessions: sessions.length,
      parType,
    };
  }

  private comparer(actuelles: SessionBroyageBE[] | null, precedentes: SessionBroyageBE[] | null) {
    const a = this.indicateurs(actuelles);
    const p = this.indicateurs(precedentes);
    if (!a || !p) return null;
    const variation = p.production > 0 ? Math.round(((a.production - p.production) / p.production) * 1000) / 10 : null;
    return { actuel: a, precedent: p, variation };
  }

  private huitSemaines(): Omit<Semaine, 'sessions'>[] {
    const lundiCourant = ajouterJours(this.aujourdhui, -((new Date().getDay() + 6) % 7));
    const resultat: Omit<Semaine, 'sessions'>[] = [];
    for (let i = 7; i >= 0; i--) {
      const debut = ajouterJours(lundiCourant, -7 * i);
      const fin = i === 0 ? this.aujourdhui : ajouterJours(debut, 6);
      resultat.push({ debut, fin, libelle: this.libelleSemaine(debut, i) });
    }
    return resultat;
  }

  private libelleSemaine(debut: string, i: number): string {
    return i === 0 ? 'Cette semaine' : `Sem. du ${debut.slice(8, 10)}/${debut.slice(5, 7)}`;
  }

  private joursDansMoisPrecedent(): number {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 0).getDate();
  }
}
