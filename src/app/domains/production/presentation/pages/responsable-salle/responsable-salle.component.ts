import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ProductionService, AffectationBE, FicheProductionBE, PPHBE,
  ClassementExecuteurBE, RapportHebdoAffectationBE, ComparaisonFutsProductionBE,
  CODES_POSTE, DUREES_AFFECTATION, CodePosteRef, DashboardAgentBE
} from '../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/charts/donut-chart.component';
import { finalize } from 'rxjs';

interface LigneAffectationForm {
  poste: string;
  matriculesEmployesTexte: string;
  duree: string;
}

interface ProductionIndividuelleForm {
  matriculeEmploye: string;
  nomEmploye: string;
  quantiteRealisee: number;
}

@Component({
  selector: 'app-responsable-salle',
  standalone: true,
  imports: [CommonModule, FormsModule, MiniChartComponent, DonutChartComponent],
  templateUrl: './responsable-salle.component.html',
  styleUrls: ['./responsable-salle.component.css']
})
export class ResponsableSalleComponent implements OnInit {
  private readonly service = inject(ProductionService);
  private readonly router = inject(Router);

  codesPoste: CodePosteRef[] = CODES_POSTE;
  durees = DUREES_AFFECTATION;

  pphs: PPHBE[] = [];
  selectedPph: PPHBE | null = null;
  affectation: AffectationBE | null = null;
  fiche: FicheProductionBE | null = null;
  date = new Date().toISOString().split('T')[0];
  isLoading = false;
  error: string | null = null;
  success: string | null = null;

  matriculeAgent = '';

  tab: 'affectation' | 'saisie' | 'fiche' | 'classement' | 'rapport' = 'affectation';

  nouvelleAffectation: LigneAffectationForm[] = [];

  showSaisieModal = false;
  saisieCourante: { poste: string; quantiteRealisee: number; productions: ProductionIndividuelleForm[] } | null = null;

  classementDebut = this.debutSemaine(new Date());
  classementFin = this.date;
  classement: ClassementExecuteurBE[] = [];

  rapportDebut = this.debutSemaine(new Date());
  rapportFin = this.date;
  rapport: RapportHebdoAffectationBE | null = null;

  comparaisonFuts: ComparaisonFutsProductionBE | null = null;

  // ── Données de graphiques (dérivées de données réelles déjà chargées) ──

  /** Classement des exécutants sous forme de graphique en barres (quantité totale réalisée). */
  serieClassementExecuteurs(): ChartSeries[] {
    return [{ name: 'Quantité réalisée', color: 'var(--success, #2e7d32)', values: this.classement.map(c => c.quantiteTotaleRealisee) }];
  }
  labelsClassementExecuteurs(): string[] {
    return this.classement.map(c => c.nomEmploye);
  }

  /** Écart prévu (fûts dosés) vs réalisé (production réelle) par jour — comparaison directe du document. */
  serieEcartJournalier(): ChartSeries[] {
    const jours = this.rapport?.comparaisonsJournalieres ?? [];
    return [{ name: 'Écart (%)', color: 'var(--danger, #d32f2f)', values: jours.map(j => Math.round(j.ecartPourcentage * 10) / 10) }];
  }
  labelsEcartJournalier(): string[] {
    return (this.rapport?.comparaisonsJournalieres ?? []).map(j => j.date.slice(5).split('-').reverse().join('/'));
  }

  /** Fûts nets vs Production réelle (kg) par jour de la semaine sélectionnée. */
  serieFutsVsProduction(): ChartSeries[] {
    const jours = this.rapport?.comparaisonsJournalieres ?? [];
    return [
      { name: 'Fûts nets', color: 'var(--info, #0284c7)', values: jours.map(j => j.nbFutsNets) },
      { name: 'Production (kg)', color: 'var(--success, #2e7d32)', values: jours.map(j => j.productionReelleKg) },
    ];
  }

  /** Répartition de la production du jour par poste (classement de l'affectation en cours). */
  donutPostesJour(): DonutSlice[] {
    const palette = ['#1976d2', '#2e7d32', '#f57c00', '#7b1fa2', '#c2185b', '#00838f', '#5d4037', '#455a64'];
    return (this.affectation?.classement ?? []).map((c, i) => ({
      label: c.libellePoste, value: c.quantiteRealisee, color: palette[i % palette.length],
    }));
  }

  // Historique des fiches du PPH sélectionné (GET /fiches/pph/{ref})
  fichesHistorique: FicheProductionBE[] = [];

  // Détail d'une affectation précise par ID (GET /affectations/{id})
  affectationDetailId: number | null = null;
  affectationDetail: AffectationBE | null = null;

  // Dashboard "ma journée" du responsable de salle (GET /dashboard/agent)
  dashboardAgent: DashboardAgentBE | null = null;

  ngOnInit() {
    this.chargerPPHs();
    this.service.getDashboardAgent().subscribe({
      next: d => this.dashboardAgent = d,
      error: () => this.dashboardAgent = null
    });
  }

  chargerPPHs() {
    this.isLoading = true;
    this.service.getPPHs()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: pphs => this.pphs = pphs,
        error: err => this.error = 'Erreur chargement PPH : ' + (err?.message ?? err)
      });
  }

  selectionnerPph(pph: PPHBE) {
    this.selectedPph = pph;
    this.error = null;
    this.chargerAffectation(pph.referencePPH);
    this.chargerFiche(pph.referencePPH, this.date);
    this.nouvelleAffectation = [];
  }

  chargerAffectation(referencePPH: string) {
    this.isLoading = true;
    this.service.getAffectationDuJour(referencePPH)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: a => this.affectation = a,
        error: err => {
          this.affectation = null;
          this.error = 'Aucune affectation trouvée pour ce jour : ' + (err?.message ?? err);
        }
      });
  }

  chargerFiche(referencePPH: string, date: string) {
    this.service.getFiche(referencePPH, date).subscribe({
      next: f => this.fiche = f,
      error: () => this.fiche = null
    });
    this.service.getFichesParPPH(referencePPH).subscribe({
      next: list => this.fichesHistorique = list,
      error: () => this.fichesHistorique = []
    });
  }

  /** Consultation directe d'une affectation par son identifiant technique. */
  chargerAffectationParId(): void {
    if (!this.affectationDetailId) return;
    this.service.getAffectation(this.affectationDetailId).subscribe({
      next: a => this.affectationDetail = a,
      error: () => this.affectationDetail = null
    });
  }

  creerAffectation() {
    if (!this.selectedPph || this.nouvelleAffectation.length === 0) return;
    const lignes = this.nouvelleAffectation
      .filter(l => l.poste && l.matriculesEmployesTexte.trim())
      .map(l => ({
        poste: l.poste,
        matriculesEmployes: l.matriculesEmployesTexte.split(',').map(m => m.trim()).filter(Boolean),
        duree: l.duree || 'JOURNEE_COMPLETE'
      }));
    if (lignes.length === 0) {
      this.error = 'Veuillez renseigner au moins un poste avec ses matricules';
      return;
    }
    this.service.creerAffectation({
      referencePPH: this.selectedPph.referencePPH,
      date: this.date,
      lignes
    }).subscribe({
      next: a => {
        this.affectation = a;
        this.success = 'Affectation créée.';
        this.error = null;
        this.nouvelleAffectation = [];
      },
      error: err => this.error = 'Erreur création affectation : ' + (err?.message ?? err)
    });
  }

  ajouterLigneAffectation() {
    this.nouvelleAffectation.push({ poste: '', matriculesEmployesTexte: '', duree: 'JOURNEE_COMPLETE' });
  }

  retirerLigneAffectation(index: number) {
    this.nouvelleAffectation.splice(index, 1);
  }

  libellePoste(code: string): string {
    return this.codesPoste.find(c => c.code === code)?.libelle ?? code;
  }

  validerAffectation() {
    if (!this.affectation) return;
    if (!confirm('Valider cette affectation ? Elle sera verrouillée et aucune saisie ne sera plus possible.')) return;
    this.service.validerAffectation(this.affectation.id).subscribe({
      next: a => { this.affectation = a; this.success = 'Affectation validée et verrouillée.'; },
      error: err => this.error = 'Erreur validation : ' + (err?.message ?? err)
    });
  }

  ouvrirSaisie(poste: string) {
    this.saisieCourante = { poste, quantiteRealisee: 0, productions: [] };
    this.showSaisieModal = true;
  }

  ajouterProductionIndividuelle() {
    this.saisieCourante?.productions.push({ matriculeEmploye: '', nomEmploye: '', quantiteRealisee: 0 });
  }

  retirerProductionIndividuelle(i: number) {
    this.saisieCourante?.productions.splice(i, 1);
  }

  confirmerSaisie() {
    if (!this.affectation || !this.saisieCourante) return;
    const productionsIndividuelles = this.saisieCourante.productions
      .filter(p => p.matriculeEmploye.trim())
      .map(p => ({ ...p, poste: this.saisieCourante!.poste }));

    this.service.saisirRealisationPoste({
      affectationId: this.affectation.id,
      poste: this.saisieCourante.poste,
      quantiteRealisee: this.saisieCourante.quantiteRealisee,
      productionsIndividuelles
    }).subscribe({
      next: a => {
        this.affectation = a;
        this.success = 'Réalisation enregistrée.';
        this.showSaisieModal = false;
        this.saisieCourante = null;
      },
      error: err => this.error = 'Erreur saisie : ' + (err?.message ?? err)
    });
  }

  enregistrerFiche() {
    if (!this.selectedPph) return;
    if (!this.matriculeAgent.trim()) {
      this.error = 'Veuillez renseigner votre matricule pour enregistrer la fiche';
      return;
    }
    const lignes = this.fiche?.lignes.map(l => ({
      codeProduit: l.codeProduit, nomProduit: l.nomProduit, quantiteProduite: l.quantiteProduite
    })) ?? this.selectedPph.lignes.map(l => ({
      codeProduit: l.codeProduit, nomProduit: l.nomProduit, quantiteProduite: 0
    }));

    this.service.enregistrerFiche({
      referencePPH: this.selectedPph.referencePPH,
      semaine: this.selectedPph.semaine,
      date: this.date,
      matriculeAgentProduction: this.matriculeAgent.trim(),
      lignes,
      predictionDosage: this.fiche?.predictionDosage,
      predictionPostes: this.fiche?.predictionPostes
    }).subscribe({
      next: f => {
        this.fiche = f;
        this.success = 'Fiche enregistrée.';
      },
      error: err => this.error = 'Erreur fiche : ' + (err?.message ?? err)
    });
  }

  corrigerFiche() {
    if (!this.selectedPph || !this.fiche) return;
    this.service.modifierFiche(this.selectedPph.referencePPH, this.date, {
      lignes: this.fiche.lignes.map(l => ({ codeProduit: l.codeProduit, nomProduit: l.nomProduit, quantiteProduite: l.quantiteProduite }))
    }).subscribe({
      next: f => { this.fiche = f; this.success = 'Fiche corrigée.'; },
      error: err => this.error = 'Erreur correction fiche (fiche peut-être verrouillée) : ' + (err?.message ?? err)
    });
  }

  chargerClassement() {
    this.service.getClassementExecuteurs(this.classementDebut, this.classementFin).subscribe({
      next: c => this.classement = c,
      error: err => this.error = 'Erreur classement : ' + (err?.message ?? err)
    });
  }

  chargerRapport() {
    this.service.getRapportHebdomadaireAffectation(this.rapportDebut, this.rapportFin).subscribe({
      next: r => this.rapport = r,
      error: err => this.error = 'Erreur rapport : ' + (err?.message ?? err)
    });
  }

  chargerComparaisonFuts() {
    if (!this.selectedPph) return;
    this.service.getComparaisonFutsProduction(this.selectedPph.referencePPH, this.date).subscribe({
      next: c => this.comparaisonFuts = c,
      error: err => this.error = 'Erreur comparaison fûts : ' + (err?.message ?? err)
    });
  }

  allerEmployes() {
    this.router.navigate(['/production/employes']);
  }

  trackByIndex(index: number) { return index; }

  private debutSemaine(d: Date): string {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }
}
