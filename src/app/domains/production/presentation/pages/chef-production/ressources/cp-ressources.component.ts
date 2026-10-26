import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ProductionService, RapportHebdomadaireProductionBE, SessionDosageBE } from '../../../../infrastructure/production.service';
import { DonutChartComponent, DonutSlice } from '../../../shared/charts/donut-chart.component';

type Periode = 7 | 14 | 30;

/** Date au format yyyy-mm-dd en heure locale (évite le décalage de toISOString le soir). */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Libellés lisibles des types de poudre ; à défaut, le code brut. */
const LIBELLES_POUDRE: Record<string, string> = { MAIS: 'Maïs', SOJA: 'Soja', ARACHIDE: 'Arachide' };
const COULEURS_POUDRE: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };

/**
 * GESTION DES RESSOURCES — Chef de Production.
 *
 * Consommation réelle sur une période (matières broyées, pertes, fûts, machines),
 * calculée par le backend à partir des rapports et sessions existants.
 * Il n'existe pas de stock ni d'inventaire côté Production : la page ne présente
 * donc ni disponibilité ni alerte de rupture.
 */
@Component({
  selector: 'app-cp-ressources',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, DonutChartComponent],
  templateUrl: './cp-ressources.component.html',
  styleUrls: ['./cp-ressources.component.css', '../_shared.css']
})
export class CpRessourcesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  /** Garde : seule la dernière requête peut écrire dans l'état. */
  private requete = 0;

  readonly periodes: Periode[] = [7, 14, 30];
  periode = signal<Periode>(7);
  debut = signal('');
  fin = signal('');

  rapport = signal<RapportHebdomadaireProductionBE | null>(null);
  sessionsDosage = signal<SessionDosageBE[]>([]);

  enAttente = signal(0);
  chargement = computed(() => this.enAttente() > 0);
  erreurs = signal<{ rapport?: string; dosage?: string }>({});
  derniereMaj = signal<Date | null>(null);

  // ── Matières consommées ──
  /** Quantité broyée par type de poudre (kg). */
  poudres = computed(() => {
    const r = this.rapport();
    if (!r) return [];
    const types = new Set([
      ...Object.keys(r.quantiteBroyeeParTypePoudre ?? {}),
      ...Object.keys(r.pertesParTypePoudre ?? {}),
    ]);
    const total = [...types].reduce((t, k) => t + (r.quantiteBroyeeParTypePoudre?.[k] ?? 0), 0);
    return [...types]
      .map(code => {
        const broye = r.quantiteBroyeeParTypePoudre?.[code] ?? 0;
        const pertes = r.pertesParTypePoudre?.[code] ?? 0;
        return {
          code,
          libelle: LIBELLES_POUDRE[code] ?? code,
          couleur: COULEURS_POUDRE[code] ?? '#999',
          broye,
          pertes,
          pctPertes: r.pctPertesParTypePoudre?.[code] ?? (broye > 0 ? (pertes / broye) * 100 : 0),
          partTotale: total > 0 ? (broye / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.broye - a.broye);
  });

  totalBroye = computed(() => this.poudres().reduce((t, p) => t + p.broye, 0));
  totalPertes = computed(() => this.poudres().reduce((t, p) => t + p.pertes, 0));

  donutMatieres = computed<DonutSlice[]>(() =>
    this.poudres()
      .filter(p => p.broye > 0)
      .map(p => ({ label: p.libelle, value: Math.round(p.broye * 10) / 10, color: p.couleur })));

  // ── Production par référence ──
  references = computed(() => {
    const r = this.rapport();
    if (!r) return [];
    const max = Math.max(0, ...Object.values(r.quantitesParReference ?? {}));
    return Object.entries(r.quantitesParReference ?? {})
      .map(([code, quantite]) => ({ code, quantite, part: max > 0 ? (quantite / max) * 100 : 0 }))
      .sort((a, b) => b.quantite - a.quantite);
  });

  // ── Machines ──
  machines = computed(() => {
    const map = new Map<string, number>();
    for (const s of this.sessionsDosage()) for (const m of s.machinesMobilisees) map.set(m, (map.get(m) ?? 0) + 1);
    const liste = [...map.entries()].map(([machine, nb]) => ({ machine, nb })).sort((a, b) => b.nb - a.nb);
    const max = liste[0]?.nb ?? 0;
    return liste.map(m => ({ ...m, part: max > 0 ? (m.nb / max) * 100 : 0 }));
  });

  // ── Indicateurs ──
  kpis = computed<{ libelle: string; valeur: string; detail: string; alerte?: boolean }[]>(() => {
    const r = this.rapport();
    const taux = r?.tauxPertesGlobal ?? 0;
    return [
      { libelle: 'Matière broyée', valeur: `${this.formaterKg(this.totalBroye())} kg`, detail: `${this.poudres().length} type(s) de poudre` },
      { libelle: 'Pertes', valeur: `${this.formaterKg(this.totalPertes())} kg`, detail: `taux global ${this.formaterPct(taux)}`, alerte: taux > 5 },
      { libelle: 'Fûts nets', valeur: String(r?.totalFutsNets ?? 0), detail: `${r?.totalFutsProduits ?? 0} produit(s)` },
      { libelle: 'Sessions', valeur: String((r?.nbSessionsBroyage ?? 0) + (r?.nbSessionsDosage ?? 0)), detail: `${r?.nbSessionsBroyage ?? 0} broyage · ${r?.nbSessionsDosage ?? 0} dosage` },
    ];
  });

  ngOnInit(): void { this.charger(); }

  /** Change la fenêtre (7, 14 ou 30 jours jusqu'à aujourd'hui). */
  choisirPeriode(p: Periode): void {
    if (p === this.periode()) return;
    this.periode.set(p);
    this.charger();
  }

  charger(): void {
    const id = ++this.requete;
    const maintenant = new Date();
    const fin = formaterDate(maintenant);
    const debutDate = new Date(maintenant);
    debutDate.setDate(debutDate.getDate() - (this.periode() - 1));
    const debut = formaterDate(debutDate);
    this.debut.set(debut);
    this.fin.set(fin);
    this.enAttente.set(2);
    this.erreurs.set({});

    const termine = (source: 'rapport' | 'dosage', erreur?: string) => {
      if (id !== this.requete) return;
      if (erreur) this.erreurs.update(e => ({ ...e, [source]: erreur }));
      this.enAttente.update(n => n - 1);
      if (this.enAttente() === 0) this.derniereMaj.set(new Date());
    };
    const messageErreur = (e: any) => e?.error?.erreur || e?.error?.message || 'Chargement impossible.';

    this.svc.getRapportHebdomadaireProduction(debut, fin).subscribe({
      next: r => { if (id === this.requete) this.rapport.set(r); termine('rapport'); },
      error: e => { if (id === this.requete) this.rapport.set(null); termine('rapport', messageErreur(e)); },
    });
    this.svc.getSessionsDosageParPeriode(debut, fin).subscribe({
      next: s => { if (id === this.requete) this.sessionsDosage.set(s); termine('dosage'); },
      error: e => { if (id === this.requete) this.sessionsDosage.set([]); termine('dosage', messageErreur(e)); },
    });
  }

  formaterKg(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
  }

  formaterPct(v: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} %`;
  }

  pourcentage(v: number): number {
    return Math.max(0, Math.min(100, v));
  }
}
