import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { forkJoin, of, Observable, catchError, map } from 'rxjs';
import { ProductionService, RapportHebdomadaireProductionBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../../shared/charts/donut-chart.component';

const NB_SEMAINES = 8;
const NOM_POUDRE: Record<string, string> = { MAIS: 'Maïs', SOJA: 'Soja', ARACHIDE: 'Arachide' };
const COULEUR_POUDRE: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
const PALETTE = ['#14532D', '#F6B60B', '#2A9D5F', '#1565C0', '#8E24AA', '#C62828', '#6B7280'];

/** Date au format yyyy-mm-dd en heure locale. */
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

interface Semaine { label: string; debut: string; fin: string; rapport: RapportHebdomadaireProductionBE | null }

/**
 * STATISTIQUES — Chef de Production.
 * Tout en graphiques : évolution sur 8 semaines, comparaisons semaine et mois civil,
 * répartition des poudres et des références. Chaque semaine est chargée à part :
 * une semaine en erreur apparaît comme manquante au lieu de vider la page.
 */
@Component({
  selector: 'app-cp-statistiques',
  standalone: true,
  imports: [CommonModule, DatePipe, MiniChartComponent, DonutChartComponent],
  templateUrl: './cp-statistiques.component.html',
  styleUrls: ['./cp-statistiques.component.css']
})
export class CpStatistiquesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = formaterDate(new Date());
  chargement = signal(false);
  derniereMaj = signal<Date | null>(null);
  private requete = 0;

  semaines = signal<Semaine[]>([]);
  mois = signal<{ actuel: RapportHebdomadaireProductionBE | null; precedent: RapportHebdomadaireProductionBE | null; libelleActuel: string; libellePrecedent: string }>({
    actuel: null, precedent: null, libelleActuel: '', libellePrecedent: '',
  });

  /** Semaines dont le rapport n'a pas pu être chargé. */
  semainesManquantes = computed(() => this.semaines().filter(s => !s.rapport).length);

  labels = computed(() => this.semaines().map(s => s.label));
  private valeurs(f: (r: RapportHebdomadaireProductionBE) => number): number[] {
    return this.semaines().map(s => (s.rapport ? Math.round(f(s.rapport) * 10) / 10 : 0));
  }

  // ── Comparaisons ──
  comparaisonSemaine = computed(() => {
    const s = this.semaines();
    const actuel = s[s.length - 1]?.rapport;
    const precedent = s[s.length - 2]?.rapport;
    if (!actuel || !precedent) return null;
    return this.comparer(actuel.totalQuantiteLots, precedent.totalQuantiteLots);
  });

  comparaisonMois = computed(() => {
    const m = this.mois();
    if (!m.actuel || !m.precedent) return null;
    return this.comparer(m.actuel.totalQuantiteLots, m.precedent.totalQuantiteLots);
  });

  barreSemaine: () => ChartSeries[] = () => {
    const s = this.semaines();
    return [{
      name: 'Production validée (kg)', color: '#14532D',
      values: [s[s.length - 2]?.rapport?.totalQuantiteLots ?? 0, s[s.length - 1]?.rapport?.totalQuantiteLots ?? 0],
    }];
  };
  labelsSemaine = () => {
    const s = this.semaines();
    return [s[s.length - 2]?.label ?? 'N-1', s[s.length - 1]?.label ?? 'N'];
  };

  barreMois: () => ChartSeries[] = () => {
    const m = this.mois();
    return [{ name: 'Production validée (kg)', color: '#14532D', values: [m.precedent?.totalQuantiteLots ?? 0, m.actuel?.totalQuantiteLots ?? 0] }];
  };
  labelsMois = () => {
    const m = this.mois();
    return [m.libellePrecedent, m.libelleActuel];
  };

  // ── Évolutions sur 8 semaines ──
  serieProduction: () => ChartSeries[] = () => [
    { name: 'Production validée (kg)', color: '#14532D', values: this.valeurs(r => r.totalQuantiteLots) },
  ];
  seriePertes: () => ChartSeries[] = () => [
    { name: 'Taux de pertes (%)', color: '#C62828', values: this.valeurs(r => r.tauxPertesGlobal) },
  ];
  serieFuts: () => ChartSeries[] = () => [
    { name: 'Fûts nets', color: '#F6B60B', values: this.valeurs(r => r.totalFutsNets) },
  ];
  serieSessions: () => ChartSeries[] = () => [
    { name: 'Sessions de broyage', color: '#1565C0', values: this.valeurs(r => r.nbSessionsBroyage) },
    { name: 'Sessions de dosage', color: '#2A9D5F', values: this.valeurs(r => r.nbSessionsDosage) },
  ];

  /** Broyage par type de poudre, semaine par semaine. */
  typesPoudre = computed(() => {
    const noms = new Set<string>();
    for (const s of this.semaines()) for (const k of Object.keys(s.rapport?.quantiteBroyeeParTypePoudre ?? {})) noms.add(k);
    return [...noms].sort();
  });
  serieBroyage: () => ChartSeries[] = () => this.typesPoudre().map(code => ({
    name: NOM_POUDRE[code] ?? code,
    color: COULEUR_POUDRE[code] ?? '#999',
    values: this.semaines().map(s => Math.round((s.rapport?.quantiteBroyeeParTypePoudre?.[code] ?? 0) * 10) / 10),
  }));

  // ── Répartitions sur la période (8 semaines) ──
  repartitionPoudres = computed<DonutSlice[]>(() => {
    const cumul = new Map<string, number>();
    for (const s of this.semaines()) {
      for (const [code, kg] of Object.entries(s.rapport?.quantiteBroyeeParTypePoudre ?? {})) {
        cumul.set(code, (cumul.get(code) ?? 0) + kg);
      }
    }
    return [...cumul.entries()].filter(([, kg]) => kg > 0).map(([code, kg]) => ({
      label: NOM_POUDRE[code] ?? code,
      value: Math.round(kg * 10) / 10,
      color: COULEUR_POUDRE[code] ?? '#999',
    }));
  });

  repartitionReferences = computed<DonutSlice[]>(() => {
    const cumul = new Map<string, number>();
    for (const s of this.semaines()) {
      for (const [code, q] of Object.entries(s.rapport?.quantitesParReference ?? {})) {
        cumul.set(code, (cumul.get(code) ?? 0) + q);
      }
    }
    const trie = [...cumul.entries()].filter(([, q]) => q > 0).sort((a, b) => b[1] - a[1]);
    const top = trie.slice(0, 6).map(([code, q], i) => ({ label: code, value: Math.round(q), color: PALETTE[i] }));
    const reste = trie.slice(6).reduce((t, [, q]) => t + q, 0);
    return reste > 0 ? [...top, { label: 'Autres', value: Math.round(reste), color: PALETTE[6] }] : top;
  });

  /** Pertes moyennes par type de poudre sur la période, en pourcentage. */
  pertesPoudres: () => ChartSeries[] = () => [{
    name: 'Pertes (%)',
    color: '#C62828',
    values: this.typesPoudre().map(code => {
      const sem = this.semaines().filter(s => s.rapport);
      const moy = sem.length ? sem.reduce((t, s) => t + (s.rapport!.pctPertesParTypePoudre?.[code] ?? 0), 0) / sem.length : 0;
      return Math.round(moy * 10) / 10;
    }),
  }];
  labelsPoudres = () => this.typesPoudre().map(code => NOM_POUDRE[code] ?? code);

  // ── Chargement ──
  ngOnInit(): void { this.charger(); }

  charger(): void {
    const id = ++this.requete;
    this.chargement.set(true);
    const semaines = this.dernieresSemaines(NB_SEMAINES);
    const mois = this.moisCourantEtPrecedent();

    const garde = (obs: Observable<RapportHebdomadaireProductionBE>) =>
      obs.pipe(map(r => r as RapportHebdomadaireProductionBE | null), catchError(() => of(null)));

    forkJoin({
      semaines: forkJoin(semaines.map(s => garde(this.svc.getRapportHebdomadaireProduction(s.debut, s.fin)))),
      actuel: garde(this.svc.getRapportHebdomadaireProduction(mois.actuel.debut, mois.actuel.fin)),
      precedent: garde(this.svc.getRapportHebdomadaireProduction(mois.precedent.debut, mois.precedent.fin)),
    }).subscribe(res => {
      if (id !== this.requete) return;
      this.semaines.set(semaines.map((s, i) => ({ label: s.label, debut: s.debut, fin: s.fin, rapport: res.semaines[i] })));
      this.mois.set({
        actuel: res.actuel, precedent: res.precedent,
        libelleActuel: mois.actuel.libelle, libellePrecedent: mois.precedent.libelle,
      });
      this.chargement.set(false);
      this.derniereMaj.set(new Date());
    });
  }

  /** Les NB dernières semaines civiles (lundi → dimanche), la dernière étant la semaine en cours. */
  private dernieresSemaines(n: number): { debut: string; fin: string; label: string }[] {
    const lundi = lundiDe(new Date());
    const result: { debut: string; fin: string; label: string }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const debut = new Date(lundi); debut.setDate(debut.getDate() - i * 7);
      const fin = new Date(debut); fin.setDate(debut.getDate() + 6);
      const finBorne = fin > new Date() ? new Date() : fin;
      result.push({ debut: formaterDate(debut), fin: formaterDate(finBorne), label: `S${this.numeroSemaine(debut)}` });
    }
    return result;
  }

  private numeroSemaine(d: Date): string {
    const cible = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const jour = cible.getUTCDay() || 7;
    cible.setUTCDate(cible.getUTCDate() + 4 - jour);
    const debutAnnee = new Date(Date.UTC(cible.getUTCFullYear(), 0, 1));
    return String(Math.ceil(((cible.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7)).padStart(2, '0');
  }

  /** Mois civil en cours (1er → aujourd'hui) et mois précédent (1er → dernier jour). */
  private moisCourantEtPrecedent(): {
    actuel: { debut: string; fin: string; libelle: string };
    precedent: { debut: string; fin: string; libelle: string };
  } {
    const now = new Date();
    const debutActuel = new Date(now.getFullYear(), now.getMonth(), 1);
    const finPrecedent = new Date(now.getFullYear(), now.getMonth(), 0);
    const debutPrecedent = new Date(finPrecedent.getFullYear(), finPrecedent.getMonth(), 1);
    const libelle = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return {
      actuel: { debut: formaterDate(debutActuel), fin: formaterDate(now), libelle: libelle(now) },
      precedent: { debut: formaterDate(debutPrecedent), fin: formaterDate(finPrecedent), libelle: libelle(debutPrecedent) },
    };
  }

  private comparer(actuel: number, precedent: number): { actuel: number; precedent: number; variation: number | null } {
    return {
      actuel: Math.round(actuel * 10) / 10,
      precedent: Math.round(precedent * 10) / 10,
      variation: precedent > 0 ? Math.round(((actuel - precedent) / precedent) * 1000) / 10 : null,
    };
  }

  formaterKg(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
  }
}
