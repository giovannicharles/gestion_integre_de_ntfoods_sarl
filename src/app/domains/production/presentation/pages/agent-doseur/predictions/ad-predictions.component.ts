import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, PPHBE, PredictionPPHBE } from '../../../../infrastructure/production.service';

/** Poudre contenue dans un fût (règle de dosage). */
const POUDRE_PAR_FUT_KG = 50;

/**
 * PRÉDICTIONS DE PRODUCTION — Agent Doseur.
 * Pour un plan validé ou en cours, l'agent saisit le nombre de fûts. Le système calcule les produits
 * qui doivent sortir (produits du bon de commande du plan) et la poudre attribuée à chacun.
 * La prédiction est enregistrée : c'est la référence lue par les autres rôles.
 */
@Component({
  selector: 'app-ad-predictions',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './ad-predictions.component.html',
  styleUrls: ['./ad-predictions.component.css'],
})
export class AdPredictionsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly plans = signal<PPHBE[]>([]);
  readonly chargementPlans = signal(true);
  readonly chargementPrediction = signal(false);
  readonly calcul = signal(false);
  readonly erreur = signal('');
  readonly succes = signal('');
  readonly sessionExpiree = signal(false);

  readonly referenceChoisie = signal('');
  readonly nbFuts = signal<number>(0);
  readonly prediction = signal<PredictionPPHBE | null>(null);

  /** Plans sur lesquels une prédiction a du sens : validés ou en cours. */
  readonly plansValides = computed(() =>
    this.plans()
      .filter(p => p.statut === 'VALIDE' || p.statut === 'EN_COURS')
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut)));

  readonly planChoisi = computed(() =>
    this.plansValides().find(p => p.referencePPH === this.referenceChoisie()) ?? null);

  readonly poudreAttendueKg = computed(() => this.nbFuts() > 0 ? this.nbFuts() * POUDRE_PAR_FUT_KG : 0);

  readonly peutCalculer = computed(() => !!this.planChoisi() && this.nbFuts() > 0 && !this.calcul());

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargementPlans.set(true);
    this.erreur.set('');
    this.svc.getPPHs().subscribe({
      next: list => { this.plans.set(list); this.chargementPlans.set(false); },
      error: (e: { status?: number; error?: { erreur?: string; message?: string } }) => {
        this.gererErreur(e, 'Les plans de production n\'ont pas pu être chargés.');
        this.chargementPlans.set(false);
      },
    });
  }

  choisirPlan(reference: string): void {
    this.referenceChoisie.set(reference);
    this.prediction.set(null);
    this.nbFuts.set(0);
    this.erreur.set('');
    this.succes.set('');
    if (reference) this.chargerPrediction(reference);
  }

  calculer(): void {
    const plan = this.planChoisi();
    if (!plan || this.nbFuts() <= 0) return;
    this.calcul.set(true);
    this.erreur.set('');
    this.succes.set('');
    this.svc.calculerPredictionPPH(plan.referencePPH, this.nbFuts()).subscribe({
      next: p => {
        this.prediction.set(p);
        this.succes.set('Prédiction enregistrée : elle est désormais la référence pour les autres rôles.');
        this.calcul.set(false);
      },
      error: (e: { status?: number; error?: { erreur?: string; message?: string } }) => {
        this.gererErreur(e, 'Le calcul de la prédiction a échoué.');
        this.calcul.set(false);
      },
    });
  }

  private chargerPrediction(reference: string): void {
    this.chargementPrediction.set(true);
    this.svc.getPredictionPPH(reference).subscribe({
      next: p => {
        this.prediction.set(p);
        this.nbFuts.set(p.nbFuts);
        this.chargementPrediction.set(false);
      },
      error: (e: { status?: number; error?: { erreur?: string; message?: string } }) => {
        // 404 : aucune prédiction calculée pour ce plan encore, situation normale
        if (e?.status !== 404) this.gererErreur(e, 'La prédiction du plan n\'a pas pu être chargée.');
        this.chargementPrediction.set(false);
      },
    });
  }

  private gererErreur(e: { status?: number; error?: { erreur?: string; message?: string } }, repli: string): void {
    // 401 : session fermée (le compte a été ouvert ailleurs), à distinguer d'un vrai échec
    this.sessionExpiree.set(e?.status === 401);
    this.erreur.set(e?.status === 401
      ? 'Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.'
      : e?.error?.erreur || e?.error?.message || repli);
  }
}
