import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import {
  ProductionService, RapportHebdoAffectationBE, PerformancePosteBE, ClassementExecuteurBE, RegistreProductionBE,
} from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type DureePeriode = 8 | 12 | 26;

interface Semaine { debut: string; fin: string; label: string; }
interface PointSemaine { semaine: Semaine; rapport: RapportHebdoAffectationBE; }

/**
 * STATISTIQUES — Responsable de Salle.
 * Tout en graphiques, sur 8, 12 ou 26 semaines : production, dosage, fûts, présence, postes et employés —
 * à partir du rapport hebdomadaire déjà corrigé (#96, #98) et des endpoints de performance par période
 * (#99, #98), sans jamais additionner des quantités d'unités différentes.
 * Chaque semaine a sa propre tolérance aux erreurs : l'échec d'une source n'efface pas les autres.
 */
@Component({
  selector: 'app-rs-statistiques',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, MiniChartComponent],
  templateUrl: './rs-statistiques.component.html',
  styleUrls: ['./rs-statistiques.component.css'],
})
export class RsStatistiquesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = new Date();
  readonly duree = signal<DureePeriode>(8);

  readonly chargement = signal(true);
  readonly erreurs = signal<string[]>([]);
  readonly sessionExpiree = signal(false);

  readonly points = signal<PointSemaine[]>([]);
  readonly performancesPostes = signal<PerformancePosteBE[]>([]);
  readonly classementPeriode = signal<ClassementExecuteurBE[]>([]);
  readonly presenceParSemaine = signal<{ label: string; taux: number | null }[]>([]);

  readonly labels = computed(() => this.points().map(p => p.semaine.label));

  readonly serieProduction = computed<ChartSeries[]>(() => [
    { name: 'Production réalisée (kg, postes en kg)', color: 'var(--g, #14532D)', values: this.points().map(p => p.rapport.productionTotaleKg) },
  ]);
  readonly seriePoudreVsProduction = computed<ChartSeries[]>(() => [
    { name: 'Poudre dosée (kg)', color: 'var(--y, #F6B60B)', values: this.points().map(p => p.rapport.poidsTotalPoudreKg) },
    { name: 'Production réalisée (kg)', color: 'var(--g, #14532D)', values: this.points().map(p => p.rapport.productionTotaleKg) },
  ]);
  readonly serieFuts = computed<ChartSeries[]>(() => [
    { name: 'Fûts nets', color: 'var(--g, #14532D)', values: this.points().map(p => p.rapport.nbFutsNets) },
  ]);
  readonly serieTauxCasse = computed<ChartSeries[]>(() => [
    { name: 'Taux de casse des fûts (%)', color: 'var(--r, #C62828)', values: this.points().map(p => this.tauxCasse(p.rapport)) },
  ]);
  readonly serieJoursAffectes = computed<ChartSeries[]>(() => [
    { name: 'Jours affectés', color: 'var(--g-m, #1E7A42)', values: this.points().map(p => p.rapport.nbJoursAffectes) },
  ]);
  readonly serieSessionsDosage = computed<ChartSeries[]>(() => [
    { name: 'Sessions de dosage', color: 'var(--o, #E8820C)', values: this.points().map(p => p.rapport.nbSessionsDosage) },
  ]);
  readonly seriePresence = computed<ChartSeries[]>(() => [
    { name: 'Taux de présence (%)', color: 'var(--g, #14532D)', values: this.presenceParSemaine().map(p => p.taux ?? 0) },
  ]);

  /** Postes classés sur toute la période (depuis GET /performances-postes, #99) ; seuls les postes saisis sont retenus. */
  readonly topPostes = computed(() => this.performancesPostes().filter(p => p.rang !== null).slice(0, 8));
  readonly labelsTopPostes = computed(() => this.topPostes().map(p => p.libelle));
  readonly serieTopPostes = computed<ChartSeries[]>(() => [
    { name: 'Taux de réalisation (%)', color: 'var(--g, #14532D)', values: this.topPostes().map(p => p.tauxRealisation) },
  ]);

  /** Employés classés sur toute la période (depuis GET /classement-executeurs, taux individuel corrigé en #98). */
  readonly topEmployes = computed(() => this.classementPeriode().slice(0, 8));
  readonly labelsTopEmployes = computed(() => this.topEmployes().map(c => c.nomEmploye));
  readonly serieTopEmployes = computed<ChartSeries[]>(() => [
    { name: 'Taux individuel (%)', color: 'var(--g, #14532D)', values: this.topEmployes().map(c => c.tauxRealisationMoyen) },
  ]);

  readonly comparaisonSemaine = computed(() => {
    const p = this.points();
    if (p.length < 2) return null;
    return this.comparer(p[p.length - 1].rapport.productionTotaleKg, p[p.length - 2].rapport.productionTotaleKg);
  });
  readonly comparaisonMois = computed(() => {
    const p = this.points();
    if (p.length < 8) return null;
    const huitDernieres = p.slice(-8);
    const actuel = huitDernieres.slice(-4).reduce((s, x) => s + x.rapport.productionTotaleKg, 0);
    const precedent = huitDernieres.slice(0, 4).reduce((s, x) => s + x.rapport.productionTotaleKg, 0);
    return this.comparer(actuel, precedent);
  });

  ngOnInit(): void {
    this.charger();
  }

  choisirDuree(n: DureePeriode): void {
    this.duree.set(n);
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreurs.set([]);
    this.sessionExpiree.set(false);

    const semaines = this.dernieresSemaines(this.duree());
    const debutPeriode = semaines[0].debut;
    const finPeriode = semaines[semaines.length - 1].fin;

    // Chaque source a sa propre tolérance aux erreurs : une source en échec ne vide pas les autres.
    const garde = <T>(obs: Observable<T>, nom: string, repli: T) => obs.pipe(
      map(v => ({ ok: true as const, v, nom })),
      catchError((e: unknown) => {
        if ((e as { status?: number })?.status === 401) this.sessionExpiree.set(true);
        return of({ ok: false as const, v: repli, nom });
      }),
    );

    forkJoin({
      rapports: forkJoin(semaines.map(s =>
        garde(this.svc.getRapportHebdomadaireAffectation(s.debut, s.fin), `rapport de la semaine ${s.label}`, null as RapportHebdoAffectationBE | null))),
      performances: garde(this.svc.getPerformancesPostes(debutPeriode, finPeriode), 'performances des postes', [] as PerformancePosteBE[]),
      classement: garde(this.svc.getClassementExecuteurs(debutPeriode, finPeriode), 'classement des employés', [] as ClassementExecuteurBE[]),
      registres: garde(this.svc.getRegistres({ debut: debutPeriode, fin: finPeriode }), 'registres', [] as RegistreProductionBE[]),
    }).subscribe(r => {
      this.chargement.set(false);
      const echecs: string[] = [];

      const pts: PointSemaine[] = [];
      r.rapports.forEach((res, i) => {
        if (res.ok && res.v) pts.push({ semaine: semaines[i], rapport: res.v });
        else echecs.push(res.nom);
      });
      this.points.set(pts);

      if (!r.performances.ok) echecs.push(r.performances.nom);
      this.performancesPostes.set(r.performances.v);

      if (!r.classement.ok) echecs.push(r.classement.nom);
      this.classementPeriode.set(r.classement.v);

      if (!r.registres.ok) echecs.push(r.registres.nom);
      this.presenceParSemaine.set(this.regrouperPresenceParSemaine(r.registres.v, semaines));

      this.erreurs.set(echecs);
    });
  }

  /** Taux de casse des fûts, en % des fûts produits (0 si aucun fût produit). */
  tauxCasse(r: RapportHebdoAffectationBE): number {
    const produits = r.nbFutsProduits ?? 0;
    return produits > 0 ? Math.round(((r.nbFutsCasses ?? 0) / produits) * 1000) / 10 : 0;
  }

  private comparer(actuel: number, precedent: number): { actuel: number; precedent: number; variation: number } {
    const variation = precedent > 0 ? Math.round(((actuel - precedent) / precedent) * 1000) / 10 : 0;
    return { actuel, precedent, variation };
  }

  /** Taux de présence par semaine, à partir des registres de la période (null si aucun registre cette semaine-là). */
  private regrouperPresenceParSemaine(registres: RegistreProductionBE[], semaines: Semaine[]): { label: string; taux: number | null }[] {
    return semaines.map(s => {
      const lignes = registres.filter(r => r.date >= s.debut && r.date <= s.fin).flatMap(r => r.lignes);
      if (!lignes.length) return { label: s.label, taux: null };
      const presents = lignes.filter(l => l.present).length;
      return { label: s.label, taux: Math.round((presents / lignes.length) * 100) };
    });
  }

  /** Les n dernières semaines (lundi à dimanche), en dates locales. */
  private dernieresSemaines(n: number): Semaine[] {
    const result: Semaine[] = [];
    const aujourdhui = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const ref = new Date(aujourdhui);
      ref.setDate(ref.getDate() - i * 7);
      const jour = ref.getDay();
      const lundi = new Date(ref);
      lundi.setDate(ref.getDate() - jour + (jour === 0 ? -6 : 1));
      const dimanche = new Date(lundi);
      dimanche.setDate(lundi.getDate() + 6);
      result.push({ debut: dateLocaleIso(lundi), fin: dateLocaleIso(dimanche), label: i === 0 ? 'Actuelle' : `S-${i}` });
    }
    return result;
  }
}
