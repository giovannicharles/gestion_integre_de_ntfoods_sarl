import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ProductionService, PPHBE, PredictionPPHBE, ComparaisonFutsProductionBE, AvancementDosageBE,
} from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
export function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Écart toléré (en points) entre l'avancement réel et l'avancement attendu à la date du jour. */
const TOLERANCE_RETARD = 15;

export type StatutLigne = 'ATTEINT' | 'EN_COURS' | 'EN_RETARD' | 'SANS_OBJECTIF';

/** Une ligne du plan, avec son avancement et son statut. */
export interface LigneSuivi {
  codeProduit: string;
  nomProduit: string;
  categorie: string;
  objectif: number;
  realise: number;
  reste: number;
  pourcent: number;
  prevuAujourdhui: number;
  statut: StatutLigne;
}

/**
 * SUIVI DE PRODUCTION — Agent Doseur.
 * Pour un plan PPH : avancement par produit (objectif, réalisé, reste), statut par rapport au
 * calendrier du plan, fûts et poudre prédits (prédiction enregistrée), et comparaison
 * fûts dosés / production aval pour une journée.
 */
@Component({
  selector: 'app-ad-suivi',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './ad-suivi.component.html',
  styleUrls: ['./ad-suivi.component.css'],
})
export class AdSuiviComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();

  readonly chargementPlans = signal(true);
  readonly chargementDetail = signal(false);
  readonly chargementComparaison = signal(false);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);

  readonly pphs = signal<PPHBE[]>([]);
  readonly referenceChoisie = signal('');
  readonly prediction = signal<PredictionPPHBE | null>(null);

  readonly dateComparaison = signal(dateLocaleIso());
  readonly comparaison = signal<ComparaisonFutsProductionBE | null>(null);
  readonly comparaisonInfo = signal('');

  /** Plans suivables : tous sauf les brouillons (un brouillon n'a pas encore de production). */
  readonly plansSuivis = computed(() =>
    this.pphs()
      .filter(p => p.statut !== 'BROUILLON')
      .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut)));

  readonly planChoisi = computed(() =>
    this.plansSuivis().find(p => p.referencePPH === this.referenceChoisie()) ?? null);

  /** Avancement attendu à la date du jour, selon la durée calendaire du plan (0 à 100). */
  readonly avancementAttendu = computed(() => {
    const p = this.planChoisi();
    if (!p) return 0;
    const debut = this.jour(p.dateDebut);
    const fin = this.jour(p.dateFin);
    const today = this.jour(this.aujourdhui);
    const totalJours = Math.max(1, (fin - debut) / 86400000 + 1);
    const ecoules = Math.min(totalJours, Math.max(0, (today - debut) / 86400000 + 1));
    return Math.round((ecoules / totalJours) * 1000) / 10;
  });

  readonly lignes = computed<LigneSuivi[]>(() => {
    const p = this.planChoisi();
    if (!p) return [];
    const attendu = this.avancementAttendu();
    return p.lignes.map(l => {
      const reste = Math.max(0, l.objectifSemaine - l.productionRealisee);
      const pourcent = l.objectifSemaine > 0
        ? Math.min(100, Math.round((l.productionRealisee / l.objectifSemaine) * 1000) / 10)
        : 0;
      const prevuAujourdhui = p.lignesDetaillees
        .filter(d => d.codeProduit === l.codeProduit && d.dateJour === this.aujourdhui)
        .reduce((s, d) => s + (d.quantiteJour ?? 0), 0);
      return {
        codeProduit: l.codeProduit,
        nomProduit: l.nomProduit,
        categorie: l.categorieMetier,
        objectif: l.objectifSemaine,
        realise: l.productionRealisee,
        reste,
        pourcent,
        prevuAujourdhui,
        statut: this.statutLigne(l.objectifSemaine, l.productionRealisee, pourcent, attendu),
      };
    });
  });

  readonly objectifTotal = computed(() => this.lignes().reduce((s, l) => s + l.objectif, 0));
  readonly realiseTotal = computed(() => this.lignes().reduce((s, l) => s + l.realise, 0));
  readonly resteTotal = computed(() => Math.max(0, this.objectifTotal() - this.realiseTotal()));
  readonly tauxGlobal = computed(() =>
    this.objectifTotal() > 0 ? Math.min(100, Math.round((this.realiseTotal() / this.objectifTotal()) * 1000) / 10) : 0);
  readonly nbEnRetard = computed(() => this.lignes().filter(l => l.statut === 'EN_RETARD').length);
  readonly nbAtteints = computed(() => this.lignes().filter(l => l.statut === 'ATTEINT').length);

  /** Fûts prévus par la planification du plan (somme des journées). */
  readonly futsPrevus = computed(() => {
    const p = this.planChoisi();
    return p ? p.lignesDetaillees.reduce((s, d) => s + (d.futsPrevus ?? 0), 0) : 0;
  });

  /** Avancement du dosage : fûts dosés (sessions de dosage) face aux fûts prévus. Lecture seule. */
  readonly dosage = signal<AvancementDosageBE | null>(null);
  readonly futsDosesTotal = computed(() => this.dosage()?.futsDoses ?? 0);
  readonly resteDosage = computed(() => Math.max(0, this.futsPrevus() - this.futsDosesTotal()));
  readonly tauxDosage = computed(() =>
    this.futsPrevus() > 0 ? Math.min(100, Math.round((this.futsDosesTotal() / this.futsPrevus()) * 1000) / 10) : 0);

  /** Par journée : fûts prévus (planification) et fûts dosés validés / en cours, avec l'écart. */
  readonly dosageEnRetard = computed(() =>
    this.futsPrevus() > 0 && this.tauxDosage() < this.avancementAttendu() - TOLERANCE_RETARD);

  readonly dosageParJour = computed(() => {
    const p = this.planChoisi();
    const prevus = new Map<string, number>();
    for (const d of p?.lignesDetaillees ?? []) {
      prevus.set(d.dateJour, (prevus.get(d.dateJour) ?? 0) + (d.futsPrevus ?? 0));
    }
    const dose = new Map((this.dosage()?.parJour ?? []).map(j => [j.date, j]));
    const dates = [...new Set([...prevus.keys(), ...dose.keys()])].sort();
    return dates.map(date => {
      const j = dose.get(date);
      const pr = prevus.get(date) ?? 0;
      const valides = j?.futsValides ?? 0;
      const enCours = j?.futsEnCours ?? 0;
      return { date, prevus: pr, valides, enCours, ecart: valides + enCours - pr };
    });
  });

  readonly alertes = computed(() => {
    const alertes: { type: 'danger' | 'warning' | 'success'; texte: string }[] = [];
    const retard = this.nbEnRetard();
    if (retard > 0) alertes.push({ type: 'danger', texte: `${retard} produit(s) en retard sur le calendrier du plan` });
    if (this.dosageEnRetard()) {
      alertes.push({ type: 'danger', texte: `Dosage en retard : ${this.futsDosesTotal()} fût(s) dosé(s) sur ${this.futsPrevus()} prévu(s)` });
    }
    if (this.planChoisi() && this.tauxGlobal() >= 100) alertes.push({ type: 'success', texte: 'Objectif du plan atteint' });
    const c = this.comparaison();
    if (c && c.ecartPourcentage < -TOLERANCE_RETARD) {
      alertes.push({ type: 'danger', texte: `Production aval inférieure de ${Math.abs(Math.round(c.ecartPourcentage))} % aux fûts dosés ce jour` });
    }
    if (c && c.ecartPourcentage > TOLERANCE_RETARD) {
      alertes.push({ type: 'warning', texte: `Production aval supérieure de ${Math.round(c.ecartPourcentage)} % aux fûts dosés ce jour` });
    }
    return alertes;
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargementPlans.set(true);
    this.erreur.set('');
    this.svc.getPPHs().subscribe({
      next: list => {
        this.pphs.set(list);
        this.derniereMaj.set(new Date());
        this.chargementPlans.set(false);
        const defaut = list.find(p => p.statut === 'EN_COURS') ?? this.plansSuivis()[0];
        if (defaut && !this.referenceChoisie()) this.choisirPlan(defaut.referencePPH);
      },
      error: (e: { status?: number; error?: { erreur?: string; message?: string } }) => {
        this.gererErreur(e, 'Les plans de production n\'ont pas pu être chargés.');
        this.chargementPlans.set(false);
      },
    });
  }

  choisirPlan(reference: string): void {
    this.referenceChoisie.set(reference);
    this.prediction.set(null);
    this.dosage.set(null);
    this.comparaison.set(null);
    this.comparaisonInfo.set('');
    if (!reference) return;
    this.chargerPrediction(reference);
    this.chargerDosage(reference);
    this.comparer();
  }

  private chargerDosage(reference: string): void {
    this.svc.getAvancementDosage(reference).subscribe({
      next: a => this.dosage.set(a),
      error: (e: { status?: number; error?: { erreur?: string; message?: string } }) =>
        this.gererErreur(e, 'L\'avancement du dosage n\'a pas pu être chargé.'),
    });
  }

  comparer(): void {
    const p = this.planChoisi();
    if (!p || !this.dateComparaison()) return;
    this.chargementComparaison.set(true);
    this.comparaisonInfo.set('');
    this.svc.getComparaisonFutsProduction(p.referencePPH, this.dateComparaison()).subscribe({
      next: c => { this.comparaison.set(c); this.chargementComparaison.set(false); },
      error: (e: { status?: number; error?: { erreur?: string; message?: string } }) => {
        this.comparaison.set(null);
        if (e?.status === 404) {
          this.comparaisonInfo.set('Aucune session de dosage pour ce plan à cette date.');
        } else {
          this.gererErreur(e, 'La comparaison fûts / production n\'a pas pu être calculée.');
        }
        this.chargementComparaison.set(false);
      },
    });
  }

  private chargerPrediction(reference: string): void {
    this.chargementDetail.set(true);
    this.svc.getPredictionPPH(reference).subscribe({
      next: p => { this.prediction.set(p); this.chargementDetail.set(false); },
      // 404 : aucune prédiction calculée pour ce plan, situation normale
      error: (e: { status?: number; error?: { erreur?: string; message?: string } }) => {
        if (e?.status !== 404) this.gererErreur(e, 'La prédiction du plan n\'a pas pu être chargée.');
        this.chargementDetail.set(false);
      },
    });
  }

  private statutLigne(objectif: number, realise: number, pourcent: number, attendu: number): StatutLigne {
    if (objectif <= 0) return 'SANS_OBJECTIF';
    if (realise >= objectif) return 'ATTEINT';
    return pourcent < attendu - TOLERANCE_RETARD ? 'EN_RETARD' : 'EN_COURS';
  }

  private jour(iso: string): number {
    return Date.parse(`${iso}T00:00:00`);
  }

  private gererErreur(e: { status?: number; error?: { erreur?: string; message?: string } }, repli: string): void {
    // 401 : session fermée (le compte a été ouvert ailleurs), à distinguer d'un vrai échec
    this.sessionExpiree.set(e?.status === 401);
    this.erreur.set(e?.status === 401
      ? 'Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.'
      : e?.error?.erreur || e?.error?.message || repli);
  }
}
