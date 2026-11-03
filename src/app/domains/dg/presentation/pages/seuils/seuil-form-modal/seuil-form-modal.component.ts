import { Component, ChangeDetectionStrategy, signal, computed, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DgService, SeuilBE, DefinirSeuilRequestBE } from '../../../../infrastructure/dg.service';
import { StockApiRepository } from '../../../../../stock/infrastructure/repositories/stock-api.repository';
import { Product } from '../../../../../stock/domain/models/stock.models';
import { ToastService } from '../../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../../core/http/api-error-parser';

type TypeEntrepotSeuil = 'CENTRAL' | 'TAMPON';

/**
 * Composant dédié (2026-11-03, demande explicite du porteur : « le popup doit être bien
 * désigné, crée un composant pour cela ») pour le formulaire « Définir un seuil ».
 *
 * Corrige au passage un échec systématique signalé par le porteur (« tous les champs sont
 * bien renseignés » mais l'enregistrement échoue) : le sélecteur d'entrepôt proposait
 * « Stock mobile commercial », une option que SeuilStock.java (domaine) rejette
 * TOUJOURS (`"Les seuils ne s'appliquent qu'au central et au tampon"`) - un seuil mobile
 * n'a pas de sens, le stock mobile est alimenté par dotation depuis le tampon, pas par son
 * propre seuil de réapprovisionnement (§5.4 du contexte projet). Retiré du sélecteur.
 *
 * Le champ « Code produit » devient une recherche-au-clavier (2026-11-03, demande explicite) :
 * on tape, une liste de produits correspondants (code + désignation) apparaît, on choisit -
 * fini le code tapé à l'aveugle sans savoir à quel produit il correspond réellement.
 */
@Component({
  selector: 'app-seuil-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seuil-form-modal.component.html',
  styleUrls: ['./seuil-form-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeuilFormModalComponent {
  private readonly dgSvc = inject(DgService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly toast = inject(ToastService);

  @Output() saved = new EventEmitter<void>();

  visible = signal(false);
  saving = signal(false);
  isEdition = signal(false);

  private tousLesProduits = signal<Product[]>([]);
  private produitsCharges = false;

  formCodeProduit = signal('');
  formTypeEntrepot = signal<TypeEntrepotSeuil>('CENTRAL');
  formValeur = signal<number | null>(null);

  rechercheProduit = signal('');
  suggestionsOuvertes = signal(false);

  suggestions = computed(() => {
    const q = this.rechercheProduit().trim().toUpperCase();
    if (!q) return [];
    return this.tousLesProduits()
      .filter(p => p.sku?.toUpperCase().includes(q) || (p.designation ?? '').toUpperCase().includes(q))
      .slice(0, 8);
  });

  /** Produit réellement résolu pour le code actuellement saisi (confirmation visuelle). */
  produitResolu = computed(() => {
    const code = this.formCodeProduit().trim().toUpperCase();
    if (!code) return null;
    return this.tousLesProduits().find(p => p.sku?.toUpperCase() === code) ?? null;
  });

  ouvrir(seuil?: SeuilBE): void {
    this.isEdition.set(!!seuil);
    this.formCodeProduit.set(seuil?.codeProduit ?? '');
    this.rechercheProduit.set(seuil?.codeProduit ?? '');
    this.formTypeEntrepot.set((seuil?.typeEntrepot === 'TAMPON' ? 'TAMPON' : 'CENTRAL'));
    this.formValeur.set(seuil?.seuilReapprovisionnement ?? null);
    this.suggestionsOuvertes.set(false);
    this.visible.set(true);
    this.chargerProduitsSiBesoin();
  }

  fermer(): void {
    this.visible.set(false);
  }

  private chargerProduitsSiBesoin(): void {
    if (this.produitsCharges) return;
    this.stockRepo.getProducts().subscribe({
      next: produits => { this.tousLesProduits.set(produits); this.produitsCharges = true; },
      error: () => { /* la recherche reste vide, le code reste saisissable à la main */ },
    });
  }

  onRechercheChange(valeur: string): void {
    this.rechercheProduit.set(valeur);
    this.formCodeProduit.set(valeur);
    this.suggestionsOuvertes.set(valeur.trim().length > 0);
  }

  choisirProduit(p: Product): void {
    this.formCodeProduit.set(p.sku);
    this.rechercheProduit.set(p.sku);
    this.suggestionsOuvertes.set(false);
  }

  fermerSuggestions(): void {
    this.suggestionsOuvertes.set(false);
  }

  enregistrer(): void {
    const codeProduit = this.formCodeProduit().trim().toUpperCase();
    const valeur = this.formValeur();
    if (!codeProduit || valeur === null || valeur < 0) {
      this.toast.error('Code produit et valeur (≥ 0) obligatoires.', 'Formulaire incomplet');
      return;
    }
    const request: DefinirSeuilRequestBE = {
      codeProduit,
      typeEntrepot: this.formTypeEntrepot(),
      seuilReapprovisionnement: valeur,
    };
    this.saving.set(true);
    this.dgSvc.definirSeuil(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this.toast.success(`Seuil ${codeProduit} / ${request.typeEntrepot} enregistré.`);
        this.saved.emit();
      },
      error: e => {
        this.saving.set(false);
        this.toast.error(extractApiError(e), 'Échec de l\'enregistrement');
      },
    });
  }
}
