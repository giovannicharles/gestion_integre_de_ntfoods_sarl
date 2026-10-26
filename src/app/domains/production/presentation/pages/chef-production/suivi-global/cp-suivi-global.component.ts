import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, OFBE } from '../../../../infrastructure/production.service';

type FiltreStatut = 'TOUS' | 'EN_COURS' | 'PLANIFIE' | 'HONORE' | 'ANNULE';

/** Date du jour en heure locale, au format yyyy-mm-dd (évite le décalage de fuseau de toISOString). */
function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * SUIVI GLOBAL DE LA PRODUCTION — Chef de Production.
 * Avancement, production restante, retards et dépassements, à partir des OF réels.
 */
@Component({
  selector: 'app-cp-suivi-global',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './cp-suivi-global.component.html',
  styleUrls: ['./cp-suivi-global.component.css', '../_shared.css'],
})
export class CpSuiviGlobalComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  chargement = signal(true);
  erreur = signal('');
  derniereMaj = signal<Date | null>(null);
  ofs = signal<OFBE[]>([]);

  recherche = signal('');
  filtre = signal<FiltreStatut>('TOUS');

  readonly filtres: { code: FiltreStatut; libelle: string }[] = [
    { code: 'TOUS', libelle: 'Tous' },
    { code: 'EN_COURS', libelle: 'En cours' },
    { code: 'PLANIFIE', libelle: 'Planifiés' },
    { code: 'HONORE', libelle: 'Terminés' },
    { code: 'ANNULE', libelle: 'Annulés' },
  ];

  // ── Indicateurs ───────────────────────────────────────────────────────────
  ofEnCours = computed(() => this.ofs().filter(o => o.statut === 'EN_COURS'));
  ofTermines = computed(() => this.ofs().filter(o => o.statut === 'HONORE'));
  ofPlanifies = computed(() => this.ofs().filter(o => o.statut === 'PLANIFIE'));

  productionTotale = computed(() => this.ofs().reduce((s, o) => s + o.qteRealisee, 0));
  demandeTotale = computed(() => this.ofs().filter(o => o.statut !== 'ANNULE').reduce((s, o) => s + o.qteDemandee, 0));
  productionRestante = computed(() => this.ofs()
    .filter(o => o.statut !== 'ANNULE')
    .reduce((s, o) => s + Math.max(0, o.qteDemandee - o.qteRealisee), 0));
  tauxAvancementGlobal = computed(() => {
    const dem = this.demandeTotale();
    return dem > 0 ? Math.min(100, Math.round((this.productionTotale() / dem) * 1000) / 10) : 0;
  });

  /** Retard : OF non terminé ni annulé dont l'échéance est passée. */
  ofEnRetard = computed(() => {
    const jour = aujourdhui();
    return this.ofs()
      .filter(o => o.statut !== 'HONORE' && o.statut !== 'ANNULE' && !!o.dateButoir && o.dateButoir < jour)
      .sort((a, b) => (a.dateButoir ?? '').localeCompare(b.dateButoir ?? ''));
  });

  /** Dépassement : réalisé supérieur à la demande. */
  ofEnDepassement = computed(() => this.ofs().filter(o => o.qteRealisee > o.qteDemandee));

  /** Liste affichée : statut et recherche (numéro, produit, PPH). */
  ofsFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const f = this.filtre();
    return this.ofs()
      .filter(o => f === 'TOUS' || o.statut === f)
      .filter(o => !q
        || o.idOF.toLowerCase().includes(q)
        || o.designationProduit.toLowerCase().includes(q)
        || o.codeProduit.toLowerCase().includes(q)
        || o.referencePPH.toLowerCase().includes(q))
      .sort((a, b) => (a.dateButoir ?? '9999').localeCompare(b.dateButoir ?? '9999'));
  });

  compteStatut(code: FiltreStatut): number {
    return code === 'TOUS' ? this.ofs().length : this.ofs().filter(o => o.statut === code).length;
  }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getOFs().subscribe({
      next: liste => {
        this.ofs.set(liste);
        this.derniereMaj.set(new Date());
        this.chargement.set(false);
      },
      error: e => {
        this.chargement.set(false);
        this.erreur.set(e?.error?.erreur || e?.error?.message || 'Impossible de charger les ordres de fabrication.');
      },
    });
  }

  progression(o: OFBE): number {
    return o.qteDemandee > 0 ? Math.min(100, Math.round((o.qteRealisee / o.qteDemandee) * 100)) : 0;
  }

  libelleStatut(s: string): string {
    return ({ PLANIFIE: 'Planifié', EN_COURS: 'En cours', HONORE: 'Terminé', ANNULE: 'Annulé' } as Record<string, string>)[s] ?? s;
  }

  classeStatut(s: string): string {
    return ({ PLANIFIE: 'sg-statut-planifie', EN_COURS: 'sg-statut-encours', HONORE: 'sg-statut-termine', ANNULE: 'sg-statut-annule' } as Record<string, string>)[s] ?? '';
  }

  joursRetard(o: OFBE): number {
    const [y, m, d] = (o.dateButoir ?? aujourdhui()).split('-').map(Number);
    const [ty, tm, td] = aujourdhui().split('-').map(Number);
    return Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000));
  }
}
