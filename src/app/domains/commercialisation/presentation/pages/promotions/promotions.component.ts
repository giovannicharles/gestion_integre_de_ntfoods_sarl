import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  CommercialisationService, PromotionBE, TypePromotion, SegmentClient, StatutPromotion,
} from '../../../infrastructure/commercialisation.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

/**
 * Administration des promotions commerciales.
 *
 * <p>Écran manquant jusqu'ici, et son absence n'était pas cosmétique : le serveur
 * détermine la remise d'une vente à partir des promotions actives sur le couple
 * produit × segment client. Aucune promotion ne pouvant être créée, toute remise
 * saisie sur le terrain était refusée.</p>
 *
 * <p>Une promotion naît en brouillon. Elle ne produit d'effet qu'une fois activée :
 * la distinction est délibérée, elle permet de préparer une opération sans qu'elle
 * s'applique immédiatement aux ventes en cours.</p>
 */
@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './promotions.component.html',
  styleUrls: ['./promotions.component.css'],
})
export class PromotionsComponent implements OnInit {
  private readonly svc = inject(CommercialisationService);

  today = new Date();
  fCFA = fCFA;

  loading = signal(false);
  traitementEnCours = signal<string | null>(null);
  message = signal<{ texte: string; type: 'succes' | 'erreur' } | null>(null);

  promotions = signal<PromotionBE[]>([]);
  formulaireOuvert = signal(false);

  readonly types: { valeur: TypePromotion; libelle: string; unite: string }[] = [
    { valeur: 'POURCENTAGE', libelle: 'Pourcentage', unite: '%' },
    { valeur: 'MONTANT_FIXE', libelle: 'Montant fixe', unite: 'FCFA' },
    { valeur: 'REMISE_VOLUME', libelle: 'Remise sur volume', unite: '%' },
    { valeur: 'GRATUITE', libelle: 'Produit offert', unite: '—' },
  ];

  readonly segments: SegmentClient[] =
    ['DETAIL', 'GROSSISTE', 'SEMI_GROSSISTE', 'DISTRIBUTEUR', 'REVENDEUR'];

  // Formulaire de création
  code = signal('');
  libelle = signal('');
  description = signal('');
  type = signal<TypePromotion>('POURCENTAGE');
  valeurReduction = signal<number | null>(null);
  codeProduit = signal('');
  segmentCible = signal<SegmentClient | ''>('');
  dateDebut = signal(this.aujourdhui());
  dateFin = signal('');
  limiteUtilisations = signal(0);

  actives = computed(() => this.promotions().filter(p => p.statut === 'ACTIVEE'));
  brouillons = computed(() => this.promotions().filter(p => p.statut === 'BROUILLON'));
  inactives = computed(() =>
    this.promotions().filter(p => p.statut !== 'ACTIVEE' && p.statut !== 'BROUILLON')
  );

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    this.svc.getPromotions()
      .pipe(catchError(() => of([] as PromotionBE[])))
      .subscribe({
        next: p => { this.promotions.set(p); this.loading.set(false); },
        error: () => {
          this.loading.set(false);
          this.afficher("Les promotions n'ont pas pu être chargées.", 'erreur');
        },
      });
  }

  uniteDe(type: TypePromotion): string {
    return this.types.find(t => t.valeur === type)?.unite ?? '';
  }

  /** Ce que la promotion retire réellement, formulé sans ambiguïté d'unité. */
  effetDe(p: PromotionBE): string {
    switch (p.type) {
      case 'POURCENTAGE':
      case 'REMISE_VOLUME':
        return `−${p.valeurReduction} % du montant de la ligne`;
      case 'MONTANT_FIXE':
        return `−${this.fCFA(p.valeurReduction)} par ligne`;
      case 'GRATUITE':
        return 'Produit offert — aucune remise en valeur';
    }
  }

  portee(p: PromotionBE): string {
    const produit = p.codeProduit ? p.codeProduit : 'tous produits';
    const segment = p.segmentCible ? p.segmentCible : 'tous segments';
    return `${produit} · ${segment}`;
  }

  formulaireValide(): boolean {
    const valeur = this.valeurReduction();
    if (!this.code().trim() || !this.libelle().trim()) return false;
    if (this.type() !== 'GRATUITE' && (valeur === null || !Number.isFinite(valeur) || valeur <= 0)) return false;
    if (!this.dateDebut()) return false;
    if (this.dateFin() && this.dateFin() < this.dateDebut()) return false;
    return true;
  }

  creer(): void {
    if (!this.formulaireValide()) return;

    this.traitementEnCours.set('creation');
    this.svc.creerPromotion({
      code: this.code().trim().toUpperCase(),
      libelle: this.libelle().trim(),
      description: this.description().trim() || undefined,
      type: this.type(),
      valeurReduction: this.valeurReduction() ?? 0,
      codeProduit: this.codeProduit().trim().toUpperCase() || undefined,
      segmentCible: this.segmentCible() || undefined,
      dateDebut: this.dateDebut(),
      dateFin: this.dateFin() || undefined,
      limiteUtilisations: this.limiteUtilisations() ?? 0,
    }).subscribe({
      next: (p) => {
        this.traitementEnCours.set(null);
        this.reinitialiser();
        this.formulaireOuvert.set(false);
        this.afficher(
          `Promotion ${p.code} créée en brouillon. Elle n'ouvrira droit à une remise qu'une fois activée.`,
          'succes');
        this.charger();
      },
      error: (e) => {
        this.traitementEnCours.set(null);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  activer(p: PromotionBE): void {
    this.agir(p, () => this.svc.activerPromotion(p.code),
      `Promotion ${p.code} activée : les remises correspondantes sont désormais acceptées.`);
  }

  suspendre(p: PromotionBE): void {
    this.agir(p, () => this.svc.suspendrePromotion(p.code),
      `Promotion ${p.code} suspendue : les remises correspondantes seront refusées.`);
  }

  annuler(p: PromotionBE): void {
    this.agir(p, () => this.svc.annulerPromotion(p.code), `Promotion ${p.code} annulée.`);
  }

  private agir(p: PromotionBE, action: () => ReturnType<CommercialisationService['activerPromotion']>,
               succes: string): void {
    this.traitementEnCours.set(p.code);
    action().subscribe({
      next: () => {
        this.traitementEnCours.set(null);
        this.afficher(succes, 'succes');
        this.charger();
      },
      error: (e) => {
        this.traitementEnCours.set(null);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  statutClass(statut: StatutPromotion): string {
    switch (statut) {
      case 'ACTIVEE': return 'badge bg-success';
      case 'BROUILLON': return 'badge bg-neutral';
      case 'SUSPENDUE': return 'badge bg-orange';
      default: return 'badge bg-neutral';
    }
  }

  private reinitialiser(): void {
    this.code.set('');
    this.libelle.set('');
    this.description.set('');
    this.type.set('POURCENTAGE');
    this.valeurReduction.set(null);
    this.codeProduit.set('');
    this.segmentCible.set('');
    this.dateDebut.set(this.aujourdhui());
    this.dateFin.set('');
    this.limiteUtilisations.set(0);
  }

  private aujourdhui(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private afficher(texte: string, type: 'succes' | 'erreur'): void {
    this.message.set({ texte, type });
  }

  private messageErreur(e: unknown): string {
    const err = e as { error?: { message?: string; erreur?: string } };
    return err?.error?.erreur ?? err?.error?.message ?? "L'opération n'a pas abouti.";
  }
}
