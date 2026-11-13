import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  FormulationService, FormulationBE, LigneFormulationBE, PerteOperationBE,
  BesoinProductionBE, CapaciteProductionBE, FormulationStatutBE,
} from '../../../../../core/services/formulation.service';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';

interface LigneEdition {
  codeMP: string;
  nomMP: string;
  quantiteUnite: number;
  pertePct: number;
  raisonPerte: string;
}

/**
 * Gestion des formulations (nomenclature de production) : matières premières nécessaires par produit fini,
 * quantités en kg, pertes par opération. Créer/modifier réservé à PRODUCTION_FORMULATION_DEFINIR (ou
 * STOCK_PRODUIT_MODIFIER) ; la validation passe par le moteur d'approbation (séparation des tâches, un
 * second acteur indépendant valide). Plan validé le 2026-11-10 par le porteur.
 */
@Component({
  selector: 'app-formulation',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink, HasPermissionDirective],
  templateUrl: './formulation.component.html',
  styleUrls: ['./formulation.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormulationComponent implements OnInit {
  private readonly svc = inject(FormulationService);

  loading = signal(false);
  formulations = signal<FormulationBE[]>([]);
  filtreStatut = signal<FormulationStatutBE | ''>('');
  message = signal('');
  erreur = signal<string | null>(null);

  // ── Détail / édition ────────────────────────────────────────
  selectionnee = signal<FormulationBE | null>(null);
  ligneEnEdition = signal<string | null>(null); // codeMP en cours d'édition
  editionQuantite = 0;
  editionPerte = 0;
  editionRaison = '';
  nouvelleLigne: LigneEdition = this.ligneVide();

  // ── Capacité / besoins ──────────────────────────────────────
  niveauSimulation = '';
  nombreUnitesSimulation = 1;
  besoinsSimules = signal<BesoinProductionBE[] | null>(null);
  capaciteSimulee = signal<CapaciteProductionBE | null>(null);

  // ── Création ─────────────────────────────────────────────────
  showCreer = signal(false);
  nouvelleFormulation = this.formulationVide();
  lignesCreation: LigneEdition[] = [this.ligneVide()];

  // ── Nouvelle version ──────────────────────────────────────────
  showNouvelleVersion = signal(false);
  nouvelleVersionCode = '';
  nouvelleVersionLibelle = '';

  nbBrouillons = computed(() => this.formulations().filter(f => f.statut === 'BROUILLON').length);
  nbValidees = computed(() => this.formulations().filter(f => f.statut === 'VALIDEE').length);
  nbObsoletes = computed(() => this.formulations().filter(f => f.statut === 'OBSOLETE').length);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.lister({ statut: this.filtreStatut() || undefined }).subscribe({
      next: list => { this.formulations.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.message.set('Erreur lors du chargement des formulations'); },
    });
  }

  changerFiltre(statut: FormulationStatutBE | ''): void {
    this.filtreStatut.set(statut);
    this.charger();
  }

  ouvrirDetail(f: FormulationBE): void {
    this.svc.consulter(f.codeFormulation).subscribe({
      next: full => { this.selectionnee.set(full); this.besoinsSimules.set(null); this.capaciteSimulee.set(null); },
      error: () => this.message.set('Erreur lors du chargement du détail'),
    });
  }

  fermerDetail(): void {
    this.selectionnee.set(null);
    this.ligneEnEdition.set(null);
  }

  estModifiable(f: FormulationBE | null): boolean {
    return f?.statut === 'BROUILLON';
  }

  // ── Édition des lignes ────────────────────────────────────────

  ouvrirEditionLigne(l: LigneFormulationBE): void {
    this.ligneEnEdition.set(l.codeMP);
    this.editionQuantite = l.quantiteUnite;
    this.editionPerte = l.pertePct;
    this.editionRaison = l.raisonPerte ?? '';
  }

  annulerEditionLigne(): void {
    this.ligneEnEdition.set(null);
  }

  enregistrerLigne(): void {
    const f = this.selectionnee();
    const codeMP = this.ligneEnEdition();
    if (!f || !codeMP) return;
    this.erreur.set(null);
    this.svc.modifierLigne(f.codeFormulation, codeMP, {
      quantiteUnite: this.editionQuantite, pertePct: this.editionPerte, raisonPerte: this.editionRaison || undefined,
    }).subscribe({
      next: maj => { this.selectionnee.set(maj); this.ligneEnEdition.set(null); this.rafraichirListe(maj); },
      error: err => this.erreur.set(this.detail(err, 'Erreur lors de la modification de la ligne')),
    });
  }

  supprimerLigne(codeMP: string): void {
    const f = this.selectionnee();
    if (!f || !confirm(`Retirer la matière première ${codeMP} de la formulation ${f.codeFormulation} ?`)) return;
    this.svc.supprimerLigne(f.codeFormulation, codeMP).subscribe({
      next: maj => { this.selectionnee.set(maj); this.rafraichirListe(maj); },
      error: err => this.message.set(this.detail(err, 'Erreur lors de la suppression de la ligne')),
    });
  }

  ajouterLigneADetail(): void {
    const f = this.selectionnee();
    if (!f) return;
    const l = this.nouvelleLigne;
    if (!l.codeMP.trim() || !l.nomMP.trim() || l.quantiteUnite <= 0) {
      this.erreur.set('Code MP, nom et quantité (> 0) sont obligatoires pour ajouter une ligne.');
      return;
    }
    this.erreur.set(null);
    this.svc.ajouterLigne(f.codeFormulation, {
      codeMP: l.codeMP.trim().toUpperCase(), nomMP: l.nomMP.trim(), quantiteUnite: l.quantiteUnite, unite: 'KG',
      pertePct: l.pertePct, raisonPerte: l.raisonPerte || undefined,
    }).subscribe({
      next: maj => { this.selectionnee.set(maj); this.nouvelleLigne = this.ligneVide(); this.rafraichirListe(maj); },
      error: err => this.erreur.set(this.detail(err, 'Erreur lors de l\'ajout de la ligne')),
    });
  }

  // ── Validation ────────────────────────────────────────────────

  demanderValidation(f: FormulationBE): void {
    if (!confirm(`Soumettre la formulation ${f.codeFormulation} à validation ? Un second acteur indépendant devra l'approuver.`)) return;
    this.svc.valider(f.codeFormulation).subscribe({
      next: () => { this.message.set('Demande de validation envoyée, en attente d\'un valideur indépendant.'); this.charger(); },
      error: err => this.message.set(this.detail(err, 'Erreur lors de la demande de validation')),
    });
  }

  // ── Nouvelle version ────────────────────────────────────────────

  ouvrirNouvelleVersion(f: FormulationBE): void {
    this.selectionnee.set(f);
    this.nouvelleVersionCode = f.codeFormulation + '-V2';
    this.nouvelleVersionLibelle = '';
    this.showNouvelleVersion.set(true);
  }

  confirmerNouvelleVersion(): void {
    const f = this.selectionnee();
    if (!f || !this.nouvelleVersionCode.trim() || !this.nouvelleVersionLibelle.trim()) {
      this.erreur.set('Le nouveau code et le libellé de version sont obligatoires.');
      return;
    }
    this.erreur.set(null);
    this.svc.nouvelleVersion(f.codeFormulation, this.nouvelleVersionCode.trim(), this.nouvelleVersionLibelle.trim()).subscribe({
      next: nouvelle => {
        this.showNouvelleVersion.set(false);
        this.selectionnee.set(nouvelle);
        this.message.set(`Nouvelle version ${nouvelle.codeFormulation} créée en brouillon, à corriger puis valider.`);
        this.charger();
      },
      error: err => this.erreur.set(this.detail(err, 'Erreur lors de la création de la nouvelle version')),
    });
  }

  // ── Simulation besoin / capacité ─────────────────────────────────

  simulerBesoin(): void {
    const f = this.selectionnee();
    if (!f) return;
    this.svc.calculerBesoin(f.codeFormulation, this.nombreUnitesSimulation, this.niveauSimulation || undefined).subscribe({
      next: besoins => this.besoinsSimules.set(besoins),
      error: err => this.message.set(this.detail(err, 'Erreur lors du calcul des besoins')),
    });
  }

  simulerCapacite(): void {
    const f = this.selectionnee();
    if (!f) return;
    this.svc.predireProduction(f.codeFormulation, this.niveauSimulation || undefined).subscribe({
      next: capacite => this.capaciteSimulee.set(capacite),
      error: err => this.message.set(this.detail(err, 'Erreur lors du calcul de capacité')),
    });
  }

  // ── Création ──────────────────────────────────────────────────

  ouvrirCreer(): void {
    this.erreur.set(null);
    this.nouvelleFormulation = this.formulationVide();
    this.lignesCreation = [this.ligneVide()];
    this.showCreer.set(true);
  }

  ajouterLigneCreation(): void {
    this.lignesCreation = [...this.lignesCreation, this.ligneVide()];
  }

  retirerLigneCreation(i: number): void {
    this.lignesCreation = this.lignesCreation.filter((_, idx) => idx !== i);
  }

  creer(): void {
    const lignes = this.lignesCreation.filter(l => l.codeMP.trim() && l.nomMP.trim() && l.quantiteUnite > 0);
    const nf = this.nouvelleFormulation;
    if (!nf.codeFormulation.trim() || !nf.codeProduit.trim() || !nf.quantiteUnite || lignes.length === 0) {
      this.erreur.set('Code formulation, code produit, quantité unitaire et au moins une ligne valide sont obligatoires.');
      return;
    }
    this.erreur.set(null);
    this.svc.creer({
      codeFormulation: nf.codeFormulation.trim().toUpperCase(),
      codeProduit: nf.codeProduit.trim().toUpperCase(),
      sku: nf.sku || undefined,
      designation: nf.designation || undefined,
      codeConditionnement: nf.codeConditionnement || undefined,
      niveauConditionnement: nf.niveauConditionnement || undefined,
      quantiteUnite: nf.quantiteUnite,
      unite: nf.unite,
      version: nf.version || 'v1.0',
      lignes: lignes.map(l => ({
        codeMP: l.codeMP.trim().toUpperCase(), nomMP: l.nomMP.trim(), quantiteUnite: l.quantiteUnite,
        unite: 'KG', pertePct: l.pertePct, raisonPerte: l.raisonPerte || undefined,
      })),
    }).subscribe({
      next: creee => {
        this.showCreer.set(false);
        this.formulations.update(list => [creee, ...list]);
        this.message.set(`Formulation ${creee.codeFormulation} créée en brouillon`);
      },
      error: err => this.erreur.set(this.detail(err, 'Erreur lors de la création de la formulation')),
    });
  }

  // ── Utilitaires ───────────────────────────────────────────────

  statutClass(s: FormulationStatutBE): string {
    if (s === 'VALIDEE') return 'badge bg-success';
    if (s === 'OBSOLETE') return 'badge bg-neutral';
    return 'badge bg-orange';
  }

  private rafraichirListe(maj: FormulationBE): void {
    this.formulations.update(list => list.map(x => x.codeFormulation === maj.codeFormulation ? maj : x));
  }

  private detail(err: any, fallback: string): string {
    return err?.error?.erreur || err?.error?.message || fallback;
  }

  private ligneVide(): LigneEdition {
    return { codeMP: '', nomMP: '', quantiteUnite: 0, pertePct: 0, raisonPerte: '' };
  }

  private formulationVide() {
    return {
      codeFormulation: '', codeProduit: '', sku: '', designation: '',
      codeConditionnement: '', niveauConditionnement: '', quantiteUnite: 1, unite: 'KG', version: 'v1.0',
    };
  }
}
