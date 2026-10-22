import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConditionnementService, ConfigurationNiveauBE } from '../../../core/services/conditionnement.service';

export interface LigneConditionnement {
  codeConfiguration: string;
  typeEmballageNom: string;
  quantite: number;
}

/**
 * Saisie de quantité consciente du conditionnement (P4, 2026-10-15).
 *
 * Reçoit un code produit/SKU, interroge la vraie hiérarchie de SA variété (module conditionnement,
 * `ConditionnementService.getHierarchieParCode`) et ne propose QUE les niveaux réellement définis pour
 * CE produit — jamais un schéma fixe (sachet/gaine/carton/palette) : vérifié en base que la profondeur
 * varie, et qu'aujourd'hui la plupart des produits n'ont qu'un seul niveau renseigné (pas encore de
 * chaînage multi-niveaux côté données — signalé, pas corrigé ici, ce composant s'adapte dans les deux
 * cas sans rien inventer).
 *
 * Cas « carton incomplet » : si le niveau choisi a un niveau inférieur chaîné
 * (`contientNiveauInferieurId`), une seconde ligne de saisie apparaît pour le reste à ce niveau
 * inférieur — n'apparaît que si la donnée existe réellement pour ce produit.
 *
 * Sortie : liste de lignes `{codeConfiguration, quantite}` — la même forme que les champs déjà
 * existants côté backend (`LigneDotation.sku`, `LigneReception.sku`, `DeclarerLotRequest.conditioningType`),
 * jamais une conversion inventée en unités de base.
 */
@Component({
  selector: 'app-conditioning-quantity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conditioning-quantity.component.html',
  styleUrls: ['./conditioning-quantity.component.css']
})
export class ConditioningQuantityComponent implements OnChanges {
  private readonly conditionnementSvc = inject(ConditionnementService);

  @Input() codeProduit: string | null = null;
  @Output() lignesChange = new EventEmitter<LigneConditionnement[]>();

  loading = signal(false);
  niveaux = signal<ConfigurationNiveauBE[]>([]);
  niveauChoisiId = signal<number | null>(null);
  quantitePrincipale = signal<number>(0);
  quantiteReste = signal<number>(0);

  niveauChoisi = (): ConfigurationNiveauBE | null =>
    this.niveaux().find(n => n.id === this.niveauChoisiId()) ?? null;

  niveauInferieur = (): ConfigurationNiveauBE | null => {
    const n = this.niveauChoisi();
    if (!n || !n.contientNiveauInferieurId) return null;
    return this.niveaux().find(x => x.id === n.contientNiveauInferieurId) ?? null;
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['codeProduit']) {
      this.niveaux.set([]);
      this.niveauChoisiId.set(null);
      this.quantitePrincipale.set(0);
      this.quantiteReste.set(0);
      const code = this.codeProduit;
      if (!code) return;
      this.loading.set(true);
      this.conditionnementSvc.getHierarchieParCode(code).subscribe({
        next: niveaux => {
          // Niveau le plus élevé (ex. carton) proposé par défaut : saisie la plus naturelle en production/commande.
          const tries = [...niveaux].sort((a, b) => b.niveau - a.niveau);
          this.niveaux.set(tries);
          if (tries.length > 0) this.niveauChoisiId.set(tries[0].id);
          this.loading.set(false);
          this.emettre();
        },
        error: () => { this.loading.set(false); this.niveaux.set([]); }
      });
    }
  }

  surChangementNiveau(): void {
    this.quantiteReste.set(0);
    this.emettre();
  }

  surChangementQuantite(): void {
    this.emettre();
  }

  private emettre(): void {
    const principal = this.niveauChoisi();
    const lignes: LigneConditionnement[] = [];
    if (!principal && this.niveaux().length === 0) {
      // Aucun conditionnement défini pour ce produit : quantité brute, sans code de configuration.
      if (this.quantitePrincipale() > 0) {
        lignes.push({ codeConfiguration: '', typeEmballageNom: '', quantite: this.quantitePrincipale() });
      }
      this.lignesChange.emit(lignes);
      return;
    }
    if (principal && this.quantitePrincipale() > 0) {
      lignes.push({ codeConfiguration: principal.codeConfiguration, typeEmballageNom: principal.typeEmballageNom, quantite: this.quantitePrincipale() });
    }
    const inferieur = this.niveauInferieur();
    if (inferieur && this.quantiteReste() > 0) {
      lignes.push({ codeConfiguration: inferieur.codeConfiguration, typeEmballageNom: inferieur.typeEmballageNom, quantite: this.quantiteReste() });
    }
    this.lignesChange.emit(lignes);
  }
}
