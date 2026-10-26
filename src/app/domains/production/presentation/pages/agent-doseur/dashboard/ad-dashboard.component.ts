import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of, Observable, catchError, map } from 'rxjs';
import {
  ProductionService, SessionDosageBE, PPHBE, StatistiquesFutsBE
} from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../../shared/charts/donut-chart.component';

/** Date au format yyyy-mm-dd en heure locale (évite le décalage de toISOString le soir). */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lundi de la semaine de la date donnée, en heure locale. */
function lundiDe(d: Date): Date {
  const copie = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jour = copie.getDay();
  copie.setDate(copie.getDate() - (jour === 0 ? 6 : jour - 1));
  return copie;
}

/**
 * Code canonique d'une matière (MAIS, SOJA, ARACHIDE), quel que soit le libellé enregistré :
 * « Maïs », « maïs » et « MAIS » donnent tous « MAIS ».
 */
export function codeMatiere(nom: string): string {
  return nom.normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase();
}

/**
 * TABLEAU DE BORD — Agent Doseur.
 * Fûts, matières consommées et sessions, à partir des sessions de dosage réelles.
 * Chaque source se charge à part : une erreur sur l'une ne masque pas les autres.
 */
@Component({
  selector: 'app-ad-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, MiniChartComponent, DonutChartComponent],
  templateUrl: './ad-dashboard.component.html',
  styleUrls: ['./ad-dashboard.component.css']
})
export class AdDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = formaterDate(new Date());
  loading = signal(true);
  erreurs = signal<string[]>([]);
  sessionExpiree = signal(false);
  derniereMaj = signal<Date | null>(null);
  private requete = 0;

  sessionsJour = signal<SessionDosageBE[]>([]);
  historique30j = signal<SessionDosageBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  statsHebdo = signal<StatistiquesFutsBE | null>(null);
  statsMois = signal<StatistiquesFutsBE | null>(null);

  // ── Sessions du jour ──
  nbSessionsJour = computed(() => this.sessionsJour().length);
  sessionsJourOuvertes = computed(() => this.sessionsJour().filter(s => !s.cloturee).length);
  futsJour = computed(() => this.sessionsJour().reduce((s, x) => s + x.nbFutsNets, 0));
  nbMachinesJour = computed(() => new Set(this.sessionsJour().flatMap(s => s.machinesMobilisees)).size);

  // ── Matières (jour), via le code canonique ──
  private matiereJour(code: string): number {
    return this.sessionsJour()
      .flatMap(s => s.matieresUtilisees)
      .filter(m => codeMatiere(m.typeMatiere) === code)
      .reduce((s, m) => s + m.quantiteKg, 0);
  }
  maisJour = computed(() => this.matiereJour('MAIS'));
  sojaJour = computed(() => this.matiereJour('SOJA'));
  arachideJour = computed(() => this.matiereJour('ARACHIDE'));
  totalMatieresJour = computed(() => this.maisJour() + this.sojaJour() + this.arachideJour());

  // ── Historique et périodes ──
  sessionsOuvertes30j = computed(() => this.historique30j().filter(s => !s.cloturee).length);
  futsSemaine = computed(() => this.statsHebdo()?.nbFutsNets ?? 0);
  futsMois = computed(() => this.statsMois()?.nbFutsNets ?? 0);

  /** Estimation du type de mélange : soja majoritaire = bouillie, arachide majoritaire = arachide. */
  private typeMelange(s: SessionDosageBE): 'BOUILLIE' | 'ARACHIDE' | 'INDETERMINE' {
    const soja = s.matieresUtilisees.filter(m => codeMatiere(m.typeMatiere) === 'SOJA').reduce((t, m) => t + m.quantiteKg, 0);
    const arachide = s.matieresUtilisees.filter(m => codeMatiere(m.typeMatiere) === 'ARACHIDE').reduce((t, m) => t + m.quantiteKg, 0);
    if (soja === 0 && arachide === 0) return 'INDETERMINE';
    return soja > arachide ? 'BOUILLIE' : 'ARACHIDE';
  }
  nbMelangesBouillieJour = computed(() => this.sessionsJour().filter(s => this.typeMelange(s) === 'BOUILLIE').length);
  nbMelangesArachideJour = computed(() => this.sessionsJour().filter(s => this.typeMelange(s) === 'ARACHIDE').length);

  // ── PPH en cours ──
  pphEnCours = computed(() => this.pphs().find(p => p.statut === 'EN_COURS') ?? null);
  quantiteRestante = computed(() => {
    const p = this.pphEnCours();
    if (!p) return 0;
    return p.lignes.reduce((s, l) => s + Math.max(0, l.objectifSemaine - l.productionRealisee), 0);
  });
  tauxAvancementPph = computed(() => {
    const p = this.pphEnCours();
    if (!p || p.lignes.length === 0) return 0;
    const obj = p.lignes.reduce((s, l) => s + l.objectifSemaine, 0);
    const rea = p.lignes.reduce((s, l) => s + l.productionRealisee, 0);
    return obj > 0 ? Math.min(100, Math.round((rea / obj) * 1000) / 10) : 0;
  });

  // ── Graphiques sur 7 jours ──
  private joursGlissants(n: number): string[] {
    const jours: string[] = [];
    const maintenant = new Date();
    for (let i = n - 1; i >= 0; i--) {
      jours.push(formaterDate(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - i)));
    }
    return jours;
  }

  labels7j = computed(() => this.joursGlissants(7).map(j => `${j.slice(8, 10)}/${j.slice(5, 7)}`));

  serieFuts7j = computed<ChartSeries[]>(() => {
    const h = this.historique30j();
    return [{
      name: 'Fûts nets', color: '#2A9D5F',
      values: this.joursGlissants(7).map(j => h.filter(s => s.date === j).reduce((t, s) => t + s.nbFutsNets, 0)),
    }];
  });

  serieMelanges7j = computed<ChartSeries[]>(() => {
    const h = this.historique30j();
    const jours = this.joursGlissants(7);
    return [
      { name: 'Bouillie', color: '#1565C0', values: jours.map(j => h.filter(s => s.date === j && this.typeMelange(s) === 'BOUILLIE').length) },
      { name: 'Arachide', color: '#8E24AA', values: jours.map(j => h.filter(s => s.date === j && this.typeMelange(s) === 'ARACHIDE').length) },
    ];
  });

  donutMatieres30j = computed<DonutSlice[]>(() => {
    const couleurs: Record<string, string> = { MAIS: '#F6B60B', SOJA: '#558B2F', ARACHIDE: '#6D4C41' };
    const cumul = new Map<string, number>();
    for (const s of this.historique30j()) {
      for (const m of s.matieresUtilisees) {
        const code = codeMatiere(m.typeMatiere);
        cumul.set(code, (cumul.get(code) ?? 0) + m.quantiteKg);
      }
    }
    return [...cumul.entries()]
      .filter(([, kg]) => kg > 0)
      .map(([code, kg]) => ({ label: code.charAt(0) + code.slice(1).toLowerCase(), value: Math.round(kg * 10) / 10, color: couleurs[code] ?? '#999' }));
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    const id = ++this.requete;
    this.loading.set(true);
    this.erreurs.set([]);
    this.sessionExpiree.set(false);
    const maintenant = new Date();
    const debut30j = this.joursGlissants(30)[0];
    const debutSemaine = formaterDate(lundiDe(maintenant));
    const debutMois = formaterDate(new Date(maintenant.getFullYear(), maintenant.getMonth(), 1));

    const garde = <T>(obs: Observable<T>, nom: string, vide: T) =>
      obs.pipe(
        map(v => ({ ok: true as const, v, nom })),
        catchError((e: { status?: number }) => {
          // 401 : la session a été fermée (le compte a été ouvert ailleurs) — inutile de lister chaque source
          if (e?.status === 401) this.sessionExpiree.set(true);
          return of({ ok: false as const, v: vide, nom });
        }),
      );

    forkJoin({
      jour: garde(this.svc.getSessionsDosageParDate(this.aujourdhui), 'sessions du jour', [] as SessionDosageBE[]),
      historique: garde(this.svc.getSessionsDosageParPeriode(debut30j, this.aujourdhui), 'historique', [] as SessionDosageBE[]),
      pphs: garde(this.svc.getPPHs(), 'plans de production', [] as PPHBE[]),
      semaine: garde(this.svc.getStatistiquesFuts(debutSemaine, this.aujourdhui), 'fûts de la semaine', null as StatistiquesFutsBE | null),
      mois: garde(this.svc.getStatistiquesFuts(debutMois, this.aujourdhui), 'fûts du mois', null as StatistiquesFutsBE | null),
    }).subscribe(r => {
      if (id !== this.requete) return;
      this.erreurs.set(Object.values(r).filter(x => !x.ok).map(x => x.nom));
      this.sessionsJour.set(r.jour.v);
      this.historique30j.set(r.historique.v);
      this.pphs.set(r.pphs.v);
      this.statsHebdo.set(r.semaine.v);
      this.statsMois.set(r.mois.v);
      this.loading.set(false);
      this.derniereMaj.set(new Date());
    });
  }
}
