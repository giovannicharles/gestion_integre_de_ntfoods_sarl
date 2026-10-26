import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, PPHBE, SessionBroyageBE, AvancementBroyageBE } from '../../../../infrastructure/production.service';
import { BesoinsParJourComponent } from '../../../shared/besoins-par-jour/besoins-par-jour.component';

type Statut = 'BROUILLON' | 'VALIDE' | 'EN_COURS' | 'CLOTURE';

/** Libellés lisibles des états d'un plan. */
const LIBELLE_STATUT: Record<Statut, string> = {
  BROUILLON: 'Brouillon', VALIDE: 'Validé', EN_COURS: 'En cours', CLOTURE: 'Clôturé',
};

/**
 * PLANS DE PRODUCTION — Chef Machiniste.
 * Consultation des plans reçus (lecture seule) : synthèse, avancement par plan, filtres par état,
 * recherche et période, détail par produit, besoins par jour et sessions de broyage liées.
 */
@Component({
  selector: 'app-cm-plans',
  standalone: true,
  imports: [BesoinsParJourComponent, CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cm-plans.component.html',
  styleUrls: ['./cm-plans.component.css'],
})
export class CmPlansComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly pphs = signal<PPHBE[]>([]);
  readonly derniereMaj = signal<Date | null>(null);

  /** Sessions de broyage par plan, chargées à l'ouverture du détail. */
  readonly sessionsParPph = signal<Record<string, SessionBroyageBE[]>>({});
  readonly erreurSessions = signal('');
  /** Poudre prévue et écrasée du plan ouvert (lecture seule). */
  readonly avancementBroyage = signal<AvancementBroyageBE | null>(null);
  readonly chargementAvancement = signal(false);
  readonly erreurAvancement = signal('');
  readonly chargementSessions = signal(false);

  readonly recherche = signal('');
  readonly filtreStatut = signal<'TOUS' | Statut>('TOUS');
  readonly filtreDebut = signal('');
  readonly filtreFin = signal('');

  readonly pphSelectionne = signal<PPHBE | null>(null);

  readonly statuts: Statut[] = ['VALIDE', 'EN_COURS', 'CLOTURE', 'BROUILLON'];
  readonly libelleStatut = (s: string): string => LIBELLE_STATUT[s as Statut] ?? s;

  /** Plans correspondant à la recherche et à la période (sans le filtre d'état). */
  private readonly basFiltres = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    const debut = this.filtreDebut();
    const fin = this.filtreFin();
    return this.pphs().filter(p => {
      if (r && !p.referencePPH.toLowerCase().includes(r) && !(p.referenceBC ?? '').toLowerCase().includes(r)) return false;
      if (debut && p.dateFin < debut) return false;
      if (fin && p.dateDebut > fin) return false;
      return true;
    });
  });

  /** Compteurs par état, sur la recherche et la période, pour les segments de filtre. */
  readonly compteurs = computed(() => {
    const base = this.basFiltres();
    const compte = (s: Statut) => base.filter(p => p.statut === s).length;
    return {
      TOUS: base.length,
      VALIDE: compte('VALIDE'), EN_COURS: compte('EN_COURS'), CLOTURE: compte('CLOTURE'), BROUILLON: compte('BROUILLON'),
    };
  });

  readonly pphsFiltres = computed(() => {
    const statut = this.filtreStatut();
    return this.basFiltres()
      .filter(p => statut === 'TOUS' || p.statut === statut)
      .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
  });

  // ── Synthèse de la sélection ──
  readonly objectifTotal = computed(() => this.pphsFiltres().reduce((t, p) => t + this.objectif(p), 0));
  readonly realiseTotal = computed(() => this.pphsFiltres().reduce((t, p) => t + this.realise(p), 0));
  readonly tauxGlobal = computed(() => this.objectifTotal() > 0
    ? Math.min(100, Math.round((this.realiseTotal() / this.objectifTotal()) * 1000) / 10) : 0);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getPPHs().subscribe({
      next: list => {
        this.pphs.set(list);
        this.derniereMaj.set(new Date());
        this.chargement.set(false);
      },
      error: (e: unknown) => {
        this.noterErreur(e, 'Les plans de production n\'ont pas pu être chargés.');
        this.chargement.set(false);
      },
    });
  }

  objectif(p: PPHBE): number {
    return p.lignes.reduce((t, l) => t + l.objectifSemaine, 0);
  }

  realise(p: PPHBE): number {
    return p.lignes.reduce((t, l) => t + l.productionRealisee, 0);
  }

  /** Avancement du plan en pourcentage de son objectif (plafonné à 100). */
  avancement(p: PPHBE): number {
    const o = this.objectif(p);
    return o > 0 ? Math.min(100, Math.round((this.realise(p) / o) * 1000) / 10) : 0;
  }

  /** Produits du plan sans formule de production : ils ne donnent aucun besoin en matière première. */
  produitsSansFormule(p: PPHBE): string[] {
    return [...new Set(p.lignesDetaillees.filter(d => d.formuleManquante).map(d => d.nomProduit))];
  }

  /** Avancement d'une ligne de produit, plafonné à 100 %. */
  pctLigne(l: { objectifSemaine: number; productionRealisee: number }): number {
    return l.objectifSemaine > 0 ? Math.min(100, (l.productionRealisee / l.objectifSemaine) * 100) : 0;
  }

  ouvrirDetail(pph: PPHBE): void {
    this.pphSelectionne.set(pph);
    this.erreurSessions.set('');
    this.chargerAvancementBroyage(pph.referencePPH);
    if (this.sessionsParPph()[pph.referencePPH]) return;
    this.chargementSessions.set(true);
    this.svc.getSessionsBroyage({ referencePPH: pph.referencePPH }).subscribe({
      next: sessions => {
        this.sessionsParPph.update(m => ({ ...m, [pph.referencePPH]: sessions }));
        this.chargementSessions.set(false);
      },
      error: (e: unknown) => {
        this.chargementSessions.set(false);
        this.noterErreur(e, 'Les sessions de broyage de ce plan n\'ont pas pu être chargées.', true);
      },
    });
  }

  fermerDetail(): void {
    this.pphSelectionne.set(null);
    this.avancementBroyage.set(null);
  }

  /** Poudre prévue par le plan face à la poudre écrasée : lecture seule, les prévisions ne changent pas. */
  private chargerAvancementBroyage(reference: string): void {
    this.avancementBroyage.set(null);
    this.erreurAvancement.set('');
    this.chargementAvancement.set(true);
    this.svc.getAvancementBroyage(reference).subscribe({
      next: a => { this.avancementBroyage.set(a); this.chargementAvancement.set(false); },
      error: (e: unknown) => {
        this.chargementAvancement.set(false);
        const err = e as { status?: number; error?: { erreur?: string; message?: string } };
        this.erreurAvancement.set(err?.status === 401
          ? 'Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.'
          : err?.error?.erreur || err?.error?.message || 'L\'avancement du broyage n\'a pas pu être chargé.');
      },
    });
  }

  /** Libellé lisible d'une matière à partir de son code (MAIS → Maïs). */
  libelleMatiere(code: string): string {
    return ({ MAIS: 'Maïs', SOJA: 'Soja', ARACHIDE: 'Arachide' } as Record<string, string>)[code] ?? code;
  }

  sessionsDuPph(referencePPH: string): SessionBroyageBE[] {
    return this.sessionsParPph()[referencePPH] ?? [];
  }

  reinitialiserFiltres(): void {
    this.recherche.set('');
    this.filtreStatut.set('TOUS');
    this.filtreDebut.set('');
    this.filtreFin.set('');
  }

  private noterErreur(e: unknown, repli: string, versDetail = false): void {
    if ((e as { status?: number })?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    if (versDetail) this.erreurSessions.set(repli);
    else this.erreur.set(repli);
  }
}
