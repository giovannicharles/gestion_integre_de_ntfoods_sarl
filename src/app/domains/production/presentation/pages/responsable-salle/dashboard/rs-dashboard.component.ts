import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import {
  ProductionService, AffectationBE, DashboardResponsableSalleBE, RapportHebdoAffectationBE,
} from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

type Gravite = 'danger' | 'warning' | 'info';

/**
 * TABLEAU DE BORD — Responsable de Salle.
 * Vue d'ensemble de l'atelier pour la journée : plan en cours et son avancement, affectation et registre
 * du jour, écarts sur les postes, besoins et lots en attente. Les alertes se déduisent des données réelles.
 */
@Component({
  selector: 'app-rs-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, MiniChartComponent],
  templateUrl: './rs-dashboard.component.html',
  styleUrls: ['./rs-dashboard.component.css'],
})
export class RsDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly chargement = signal(true);
  readonly erreurs = signal<string[]>([]);
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);

  readonly dashboard = signal<DashboardResponsableSalleBE | null>(null);
  readonly affectation = signal<AffectationBE | null>(null);
  readonly semaine = signal<RapportHebdoAffectationBE | null>(null);

  readonly plan = computed(() => this.dashboard()?.planEnCours ?? null);
  readonly aff = computed(() => this.dashboard()?.affectation ?? null);
  readonly tauxAtteinte = computed(() => {
    const a = this.aff();
    return a && a.saisies > 0 ? Math.round((a.objectifsAtteints / a.saisies) * 1000) / 10 : null;
  });

  /** Alertes déduites des données du jour, de la plus grave à la moins grave. */
  readonly alertes = computed(() => {
    const d = this.dashboard();
    if (!d) return [] as { gravite: Gravite; texte: string }[];
    const out: { gravite: Gravite; texte: string }[] = [];
    if (d.affectation.ecarts > 0) out.push({ gravite: 'danger', texte: `${d.affectation.ecarts} écart(s) détecté(s) sur les postes aujourd'hui.` });
    if (d.planEnCours && !d.affectation.existe) out.push({ gravite: 'warning', texte: 'Aucune affectation des employés pour aujourd\'hui sur le plan en cours.' });
    if (d.planEnCours && !d.registreSaisi) out.push({ gravite: 'warning', texte: 'Le registre des employés du jour n\'est pas encore saisi.' });
    if (!d.planEnCours && d.plansValides > 0) out.push({ gravite: 'info', texte: `Aucun plan en cours : ${d.plansValides} plan(s) validé(s) attendent d'être démarrés.` });
    if (d.besoins.enAttente > 0) out.push({ gravite: 'info', texte: `${d.besoins.enAttente} expression(s) de besoin en attente de traitement.` });
    if (d.lots.enAttenteStock > 0) out.push({ gravite: 'info', texte: `${d.lots.enAttenteStock} lot(s) en attente de validation par le stock.` });
    return out;
  });

  readonly labelsSemaine = computed(() => (this.semaine()?.comparaisonsJournalieres ?? [])
    .map(c => c.date.slice(8, 10) + '/' + c.date.slice(5, 7)));
  readonly serieSemaine = computed<ChartSeries[]>(() => {
    const jours = this.semaine()?.comparaisonsJournalieres ?? [];
    return [
      { name: 'Fûts nets', color: '#0284c7', values: jours.map(j => j.nbFutsNets) },
      { name: 'Production (kg)', color: '#2e7d32', values: jours.map(j => j.productionReelleKg) },
    ];
  });

  readonly labelsPostes = computed(() => (this.affectation()?.classement ?? []).map(c => c.libellePoste));
  readonly seriePostes = computed<ChartSeries[]>(() => [{
    name: 'Taux de réalisation (%)', color: '#1E7A42',
    values: (this.affectation()?.classement ?? []).map(c => c.pctRealisation),
  }]);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreurs.set([]);
    this.sessionExpiree.set(false);
    forkJoin({
      dashboard: this.tolerer(this.svc.getDashboardResponsableSalle(this.aujourdhui), null, 'tableau de bord'),
      semaine: this.tolerer(this.svc.getRapportHebdomadaireAffectation(this.debutSemaine(), this.aujourdhui), null, 'rapport de la semaine'),
    }).subscribe(r => {
      this.dashboard.set(r.dashboard);
      this.semaine.set(r.semaine);
      this.derniereMaj.set(new Date());
      this.chargement.set(false);
      const ref = r.dashboard?.planEnCours?.reference;
      if (ref) {
        this.tolerer(this.svc.getAffectationDuJour(ref), null, 'affectations du jour')
          .subscribe(a => this.affectation.set(a));
      } else {
        this.affectation.set(null);
      }
    });
  }

  libelleAvancement(p: number | null | undefined): string {
    return p === null || p === undefined ? '—' : `${p.toFixed(1)} %`;
  }

  /** Une source qui échoue ne bloque pas les autres : elle reste vide et son nom est signalé. */
  private tolerer<T>(source: Observable<T>, repli: T, nom: string): Observable<T> {
    return source.pipe(catchError((e: unknown) => {
      if ((e as { status?: number })?.status === 401) {
        this.sessionExpiree.set(true);
      } else {
        this.erreurs.update(l => l.includes(nom) ? l : [...l, nom]);
      }
      return of(repli);
    }));
  }

  private debutSemaine(): string {
    const decalage = (new Date().getDay() + 6) % 7; // lundi = 0
    return ajouterJours(this.aujourdhui, -decalage);
  }
}
