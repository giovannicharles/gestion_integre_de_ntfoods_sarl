import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductionService, PPHBE, PPHLigneDetailBE } from '../../../../infrastructure/production.service';
import { BesoinsParJourComponent } from '../../../shared/besoins-par-jour/besoins-par-jour.component';

type Vue = 'VALIDE' | 'EN_COURS' | 'TOUS';

/** Code canonique d'une matière (« Maïs » → « MAIS ») pour regrouper les poudres. */
export function codeMatiere(nom: string): string {
  return nom.normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase();
}

/** Synthèse d'un plan validé : poudres, fûts prédits par le système, anomalies de données. */
export interface SynthesePlan {
  pph: PPHBE;
  poudres: { code: string; kg: number }[];
  totalKg: number;
  futsPredits: number;
  /** Lignes dont la formule est absente : aucune poudre n'a pu être calculée pour elles. */
  lignesSansFormule: number;
  /** Lignes produites sans poids unitaire : la prédiction de poudre est impossible. */
  lignesSansPoids: number;
  avancement: number;
}

/**
 * PLANS DE PRODUCTION À DOSER — Agent Doseur.
 * Plans validés (VALIDE ou EN_COURS) qui consomment de la poudre, avec le nombre de fûts que
 * le système prédit (matières nécessaires / 50 kg par fût). Les plans validés sans poudre
 * calculée ne sont pas masqués : ils sont listés à part, avec la raison.
 */
@Component({
  selector: 'app-ad-plans',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, BesoinsParJourComponent],
  templateUrl: './ad-plans.component.html',
  styleUrls: ['./ad-plans.component.css']
})
export class AdPlansComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = new Date().toISOString().slice(0, 10);
  loading = signal(true);
  error = signal('');
  sessionExpiree = signal(false);
  derniereMaj = signal<Date | null>(null);
  pphs = signal<PPHBE[]>([]);

  vue = signal<Vue>('TOUS');
  recherche = signal('');
  pphSelectionne = signal<PPHBE | null>(null);

  readonly vues: { code: Vue; libelle: string }[] = [
    { code: 'TOUS', libelle: 'Tous les plans validés' },
    { code: 'VALIDE', libelle: 'Validés' },
    { code: 'EN_COURS', libelle: 'En cours' },
  ];

  /** Toutes les synthèses des plans validés (VALIDE ou EN_COURS). */
  syntheses = computed<SynthesePlan[]>(() =>
    this.pphs()
      .filter(p => p.statut === 'VALIDE' || p.statut === 'EN_COURS')
      .map(p => this.synthese(p))
      .sort((a, b) => a.pph.dateDebut.localeCompare(b.pph.dateDebut)));

  /** Plans validés qui consomment de la poudre (ceux qui intéressent le dosage). */
  avecPoudre = computed(() => this.syntheses().filter(s => s.totalKg > 0));

  /** Plans validés sans poudre calculée : affichés à part, avec la raison. */
  sansPoudre = computed(() => this.syntheses().filter(s => s.totalKg <= 0));

  affiches = computed(() => {
    const v = this.vue();
    const q = this.recherche().trim().toLowerCase();
    return this.avecPoudre()
      .filter(s => v === 'TOUS' || s.pph.statut === v)
      .filter(s => !q || s.pph.referencePPH.toLowerCase().includes(q) || (s.pph.referenceBC ?? '').toLowerCase().includes(q));
  });

  // ── Indicateurs ──
  nbPlans = computed(() => this.avecPoudre().length);
  futsTotal = computed(() => this.avecPoudre().reduce((t, s) => t + s.futsPredits, 0));
  poudreTotale = computed(() => this.avecPoudre().reduce((t, s) => t + s.totalKg, 0));
  nbAlertes = computed(() => this.syntheses().filter(s => s.lignesSansFormule > 0 || s.lignesSansPoids > 0).length);

  /** Poudres agrégées sur les plans affichés. */
  poudresAffichees = computed(() => {
    const cumul = new Map<string, number>();
    for (const s of this.affiches()) for (const p of s.poudres) cumul.set(p.code, (cumul.get(p.code) ?? 0) + p.kg);
    return [...cumul.entries()].map(([code, kg]) => ({ code, kg })).sort((a, b) => b.kg - a.kg);
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    this.svc.getPPHs().subscribe({
      next: list => { this.pphs.set(list); this.loading.set(false); this.derniereMaj.set(new Date()); },
      error: (e: { status?: number; error?: { erreur?: string; message?: string } }) => {
        // 401 : session fermée (le compte a été ouvert ailleurs) — à distinguer d'un vrai échec de chargement
        this.sessionExpiree.set(e?.status === 401);
        this.error.set(e?.status === 401
          ? 'Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.'
          : e?.error?.erreur || e?.error?.message || 'Les plans de production n\'ont pas pu être chargés.');
        this.loading.set(false);
      },
    });
  }

  private synthese(p: PPHBE): SynthesePlan {
    const cumul = new Map<string, number>();
    let futs = 0;
    let sansFormule = 0;
    let sansPoids = 0;
    for (const l of p.lignesDetaillees) {
      futs += l.futsPrevus ?? 0;
      if (l.formuleManquante) sansFormule++;
      if (this.poidsManquant(l)) sansPoids++;
      for (const b of l.besoinsMatieresPremiere) {
        const code = codeMatiere(b.matierePremiere);
        cumul.set(code, (cumul.get(code) ?? 0) + b.quantiteKg);
      }
    }
    const poudres = [...cumul.entries()].map(([code, kg]) => ({ code, kg: Math.round(kg * 10) / 10 })).sort((a, b) => b.kg - a.kg);
    const totalKg = poudres.reduce((t, x) => t + x.kg, 0);
    return {
      pph: p,
      poudres,
      totalKg: Math.round(totalKg * 10) / 10,
      futsPredits: Math.round(futs * 10) / 10,
      lignesSansFormule: sansFormule,
      lignesSansPoids: sansPoids,
      avancement: this.avancement(p),
    };
  }

  /** Un produit à quantité prévue sans poids unitaire rend le calcul de poudre impossible. */
  poidsManquant(l: PPHLigneDetailBE): boolean {
    return (l.poidsUnitaireGrammes ?? 0) <= 0 && ((l.quantiteCartons ?? 0) > 0 || (l.nombreUnites ?? 0) > 0);
  }

  avancement(p: PPHBE): number {
    const obj = p.lignes.reduce((t, l) => t + l.objectifSemaine, 0);
    const rea = p.lignes.reduce((t, l) => t + l.productionRealisee, 0);
    return obj > 0 ? Math.min(100, Math.round((rea / obj) * 1000) / 10) : 0;
  }

  ouvrirDetail(p: PPHBE): void { this.pphSelectionne.set(p); }
  fermerDetail(): void { this.pphSelectionne.set(null); }

  libellePoudre(code: string): string {
    return ({ MAIS: 'Maïs', SOJA: 'Soja', ARACHIDE: 'Arachide' } as Record<string, string>)[code] ?? code;
  }

  libelleStatut(s: string): string {
    return ({ VALIDE: 'Validé', EN_COURS: 'En cours' } as Record<string, string>)[s] ?? s;
  }

  /** Raison lisible d'un plan validé sans poudre calculée. */
  raisonSansPoudre(s: SynthesePlan): string {
    if (s.lignesSansFormule > 0) return `${s.lignesSansFormule} produit(s) sans formule : aucune poudre calculée.`;
    if (s.lignesSansPoids > 0) return `${s.lignesSansPoids} produit(s) sans poids unitaire : la poudre ne peut pas être calculée.`;
    return 'Aucune matière à doser sur ce plan.';
  }

  reinitialiser(): void {
    this.vue.set('TOUS');
    this.recherche.set('');
  }
}
