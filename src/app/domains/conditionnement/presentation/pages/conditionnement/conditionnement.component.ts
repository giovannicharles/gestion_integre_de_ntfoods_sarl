import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ConditionnementService, MarqueBE, GammeBE, VarieteBE, TypeEmballageBE, ConfigurationNiveauBE,
  MarqueRequestBE, GammeRequestBE, VarieteRequestBE, TypeEmballageRequestBE, ConfigurationRequestBE
} from '../../../../../core/services/conditionnement.service';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';

type Tab = 'marques' | 'gammes' | 'varietes' | 'emballages' | 'configurations';

/**
 * Réécrit le 2026-11-08 : l'ancienne version appelait `/api/v1/conditionnement/...` (préfixe
 * "v1" inexistant côté backend, qui expose `/api/conditionnement/...`) via `ApiService` brut,
 * sans jamais désencapsuler `ApiResponse.donnees` - chaque chargement échouait silencieusement
 * (404, ou liste = l'objet enveloppe entier). L'écran entier n'a jamais fonctionné. Le bouton
 * "Edit" existait déjà dans le template mais n'ouvrait aucune modale (showEditModal sans modale
 * associée) : l'édition et la désactivation (soft delete, l'API les expose déjà) sont ajoutées
 * ici, sur le même modèle que le reste de l'application (confirm() avant toute désactivation).
 */
@Component({
  selector: 'app-conditionnement',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective],
  templateUrl: './conditionnement.component.html',
  styleUrls: ['./conditionnement.component.css']
})
export class ConditionnementComponent implements OnInit {
  private readonly svc = inject(ConditionnementService);

  activeTab = signal<Tab>('marques');

  marques = signal<MarqueBE[]>([]);
  gammes = signal<GammeBE[]>([]);
  varietes = signal<VarieteBE[]>([]);
  emballages = signal<TypeEmballageBE[]>([]);
  configurations = signal<ConfigurationNiveauBE[]>([]);

  /** Les configurations se consultent par variété côté backend, pas de liste globale. */
  varieteSelectionneeId = signal<number | null>(null);

  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  saving = signal<boolean>(false);

  showModal = false;
  modeEdition = false;
  selectedTab: Tab | null = null;
  selectedId: number | null = null;

  formMarque: MarqueRequestBE = { code: '', nom: '', description: '', logoUrl: '' };
  formGamme: GammeRequestBE = { code: '', nom: '', description: '' };
  formVariete: VarieteRequestBE = { gammeId: 0, marqueId: null, code: '', nom: '', description: '', poidsUnitaireG: null, unitePoids: 'G' };
  formEmballage: TypeEmballageRequestBE = { code: '', nom: '', description: '', niveauHierarchie: 1, poidsVideG: null, materiau: '', couleur: '' };
  formConfiguration: ConfigurationRequestBE = { varieteId: 0, typeEmballageId: 0, niveau: 1, quantiteUnites: 1, poidsNetG: null, referenceProduit: '', codeBarres: '', estDefault: false };

  ngOnInit() {
    this.chargerReferentiel();
  }

  chargerReferentiel() {
    this.loading.set(true);
    this.error.set(null);
    this.chargerMarques();
    this.chargerGammes();
    this.chargerVarietes();
    this.chargerEmballages();
    this.loading.set(false);
  }

  chargerMarques() {
    this.svc.getMarques().subscribe({
      next: data => this.marques.set(data),
      error: () => this.error.set('Impossible de charger les marques.')
    });
  }

  chargerGammes() {
    this.svc.getGammes().subscribe({
      next: data => this.gammes.set(data),
      error: () => this.error.set('Impossible de charger les gammes.')
    });
  }

  chargerVarietes() {
    this.svc.getVarietes().subscribe({
      next: data => this.varietes.set(data),
      error: () => this.error.set('Impossible de charger les variétés.')
    });
  }

  chargerEmballages() {
    this.svc.getTypesEmballage().subscribe({
      next: data => this.emballages.set(data),
      error: () => this.error.set("Impossible de charger les types d'emballage.")
    });
  }

  onVarieteSelectionneeChange(id: string) {
    const varieteId = id ? Number(id) : null;
    this.varieteSelectionneeId.set(varieteId);
    if (varieteId == null) { this.configurations.set([]); return; }
    this.svc.getConfigurationsVariete(varieteId).subscribe({
      next: data => this.configurations.set(data),
      error: () => this.error.set('Impossible de charger les configurations de cette variété.')
    });
  }

  switchTab(tab: Tab) {
    this.activeTab.set(tab);
  }

  ouvrirCreation(tab: Tab) {
    this.selectedTab = tab;
    this.modeEdition = false;
    this.selectedId = null;
    this.resetForms();
    if (tab === 'configurations' && this.varieteSelectionneeId() != null) {
      this.formConfiguration.varieteId = this.varieteSelectionneeId()!;
    }
    this.showModal = true;
  }

  ouvrirEdition(item: any, tab: Tab) {
    this.selectedTab = tab;
    this.modeEdition = true;
    this.selectedId = item.id;
    switch (tab) {
      case 'marques':
        this.formMarque = { code: item.code, nom: item.nom, description: item.description ?? '', logoUrl: item.logoUrl ?? '' };
        break;
      case 'gammes':
        this.formGamme = { code: item.code, nom: item.nom, description: item.description ?? '' };
        break;
      case 'varietes':
        this.formVariete = {
          gammeId: item.gammeId, marqueId: item.marqueId, code: item.code, nom: item.nom,
          description: item.description ?? '', poidsUnitaireG: item.poidsUnitaireG, unitePoids: item.unitePoids ?? 'G'
        };
        break;
      case 'emballages':
        this.formEmballage = {
          code: item.code, nom: item.nom, description: item.description ?? '', niveauHierarchie: item.niveauHierarchie,
          poidsVideG: item.poidsVideG, dimensionsLongueurMm: item.dimensionsLongueurMm, dimensionsLargeurMm: item.dimensionsLargeurMm,
          dimensionsHauteurMm: item.dimensionsHauteurMm, capaciteMaxKg: item.capaciteMaxKg, materiau: item.materiau ?? '', couleur: item.couleur ?? ''
        };
        break;
      case 'configurations':
        this.formConfiguration = {
          varieteId: item.varieteId, typeEmballageId: item.typeEmballageId, codeConfiguration: item.codeConfiguration,
          niveau: item.niveau, quantiteUnites: item.quantiteUnites, poidsNetG: item.poidsNetG,
          contientNiveauInferieurId: item.contientNiveauInferieurId, contientNombreUnitesInferieur: item.contientNombreUnitesInferieur,
          referenceProduit: item.referenceProduit ?? '', estDefault: item.estDefault
        };
        break;
    }
    this.showModal = true;
  }

  sauvegarder() {
    if (this.saving()) return;
    const tab = this.selectedTab;
    this.saving.set(true);
    const fin = () => this.saving.set(false);
    switch (tab) {
      case 'marques':
        (this.modeEdition ? this.svc.modifierMarque(this.selectedId!, this.formMarque) : this.svc.creerMarque(this.formMarque))
          .subscribe({ next: () => { fin(); this.fermerModal(); this.chargerMarques(); }, error: e => { fin(); this.error.set(this.messageErreur(e)); } });
        break;
      case 'gammes':
        (this.modeEdition ? this.svc.modifierGamme(this.selectedId!, this.formGamme) : this.svc.creerGamme(this.formGamme))
          .subscribe({ next: () => { fin(); this.fermerModal(); this.chargerGammes(); }, error: e => { fin(); this.error.set(this.messageErreur(e)); } });
        break;
      case 'varietes':
        (this.modeEdition ? this.svc.modifierVariete(this.selectedId!, this.formVariete) : this.svc.creerVariete(this.formVariete))
          .subscribe({ next: () => { fin(); this.fermerModal(); this.chargerVarietes(); }, error: e => { fin(); this.error.set(this.messageErreur(e)); } });
        break;
      case 'emballages':
        (this.modeEdition ? this.svc.modifierTypeEmballage(this.selectedId!, this.formEmballage) : this.svc.creerTypeEmballage(this.formEmballage))
          .subscribe({ next: () => { fin(); this.fermerModal(); this.chargerEmballages(); }, error: e => { fin(); this.error.set(this.messageErreur(e)); } });
        break;
      case 'configurations':
        (this.modeEdition ? this.svc.modifierConfiguration(this.selectedId!, this.formConfiguration) : this.svc.creerConfiguration(this.formConfiguration))
          .subscribe({
            next: () => { fin(); this.fermerModal(); this.onVarieteSelectionneeChange(String(this.formConfiguration.varieteId)); },
            error: e => { fin(); this.error.set(this.messageErreur(e)); }
          });
        break;
      default:
        fin();
    }
  }

  desactiver(item: any, tab: Tab) {
    const libelles: Record<Tab, string> = { marques: 'cette marque', gammes: 'cette gamme', varietes: 'cette variété', emballages: "ce type d'emballage", configurations: 'cette configuration' };
    if (!confirm(`Désactiver ${libelles[tab]} (${item.nom ?? item.codeConfiguration}) ? Elle restera visible dans l'historique mais ne sera plus proposée.`)) return;
    switch (tab) {
      case 'marques': this.svc.desactiverMarque(item.id).subscribe({ next: () => this.chargerMarques(), error: e => this.error.set(this.messageErreur(e)) }); break;
      case 'gammes': this.svc.desactiverGamme(item.id).subscribe({ next: () => this.chargerGammes(), error: e => this.error.set(this.messageErreur(e)) }); break;
      case 'varietes': this.svc.desactiverVariete(item.id).subscribe({ next: () => this.chargerVarietes(), error: e => this.error.set(this.messageErreur(e)) }); break;
      case 'emballages': this.svc.desactiverTypeEmballage(item.id).subscribe({ next: () => this.chargerEmballages(), error: e => this.error.set(this.messageErreur(e)) }); break;
      // Pas de désactivation de configuration côté backend (aucun endpoint DELETE) : non proposé.
    }
  }

  private messageErreur(e: any): string {
    return e?.error?.erreur || e?.error?.message || 'Une erreur est survenue.';
  }

  resetForms() {
    this.formMarque = { code: '', nom: '', description: '', logoUrl: '' };
    this.formGamme = { code: '', nom: '', description: '' };
    this.formVariete = { gammeId: 0, marqueId: null, code: '', nom: '', description: '', poidsUnitaireG: null, unitePoids: 'G' };
    this.formEmballage = { code: '', nom: '', description: '', niveauHierarchie: 1, poidsVideG: null, materiau: '', couleur: '' };
    this.formConfiguration = { varieteId: 0, typeEmballageId: 0, niveau: 1, quantiteUnites: 1, poidsNetG: null, referenceProduit: '', codeBarres: '', estDefault: false };
  }

  fermerModal() {
    this.showModal = false;
    this.selectedId = null;
    this.resetForms();
  }

  getNiveauLabel(niveau: number): string {
    const labels: Record<number, string> = { 1: 'Sachet', 2: 'Gaine', 3: 'Carton', 4: 'Palette' };
    return labels[niveau] || `Niveau ${niveau}`;
  }
}
