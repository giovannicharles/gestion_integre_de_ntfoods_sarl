import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DocumentSharingService, DocumentPartageItem } from '../../../../../shared/document-sharing/document-sharing.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-rp-partage',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './rp-partage.component.html',
  styleUrls: ['./rp-partage.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RpPartageComponent implements OnInit {
  private readonly sharingService = inject(DocumentSharingService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  ongletActif = signal<'EMIS' | 'RECUS'>('EMIS');
  filtreStatut = signal<string>('TOUS');
  rechercheTexte = signal<string>('');

  // Détail et fil de discussion
  itemSelectionne = signal<DocumentPartageItem | null>(null);
  nouveauCommentaireTexte = signal<string>('');

  // Modal Nouveau partage
  showModalPartage = signal(false);
  nouveauPartage = signal<{
    titre: string;
    reference: string;
    typeDocument: string;
    moduleDestinataire: string;
    destinataireNom: string;
    typeAction: 'POUR_INFORMATION' | 'POUR_VISA_SIGNATURE' | 'POUR_VALIDATION' | 'POUR_COMMENTAIRE' | 'DIFFUSION_URGENTE';
    objet: string;
  }>({
    titre: '',
    reference: 'NTF-RP-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
    typeDocument: 'RAPPORT_ACTIVITE',
    moduleDestinataire: 'DG',
    destinataireNom: 'Directeur Général',
    typeAction: 'POUR_VISA_SIGNATURE',
    objet: ''
  });

  readonly modulesCibles = [
    { code: 'DG', label: 'Direction Générale (DG)' },
    { code: 'CONTROLE', label: 'Contrôle de Gestion & Audit' },
    { code: 'COMMERCIAL', label: 'Direction Commerciale' },
    { code: 'COMPTABLE', label: 'Comptabilité & Finances' },
    { code: 'STOCK', label: 'Stock & Logistique' },
    { code: 'PRODUCTION', label: 'Production Industrielle' },
    { code: 'SECRETAIRE', label: 'Secrétariat Général' },
    { code: 'TOUS', label: 'Diffusion Générale (Tous les services)' }
  ];

  readonly typesDocuments = [
    { code: 'CONVENTION_PARTENARIAT', label: 'Convention / Accord Référencement GMS' },
    { code: 'RAPPORT_ACTIVITE', label: 'Rapport d\'Activité Périodique' },
    { code: 'BILAN_CAMPAGNE', label: 'Bilan Campagne / Dégustation & ROI' },
    { code: 'FICHE_GRAND_COMPTE', label: 'Fiche Grand Compte VIP' },
    { code: 'NOTE_CADRAGE', label: 'Note d\'Information / Cadrage' },
    { code: 'PROPOSITION_COMMERCIALE', label: 'Offre / Devis VIP Dérogatoire' }
  ];

  documentsEmis = computed(() => this.sharingService.obtenirEmisParModule('RP'));
  documentsRecus = computed(() => this.sharingService.obtenirRecusPourModule('RP'));

  listeAffichee = computed(() => {
    let list = this.ongletActif() === 'EMIS' ? this.documentsEmis() : this.documentsRecus();
    const st = this.filtreStatut();
    const q = this.rechercheTexte().trim().toLowerCase();

    if (st !== 'TOUS') {
      list = list.filter(item => item.statut === st);
    }
    if (q) {
      list = list.filter(item =>
        item.titre.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        item.objet.toLowerCase().includes(q) ||
        item.moduleDestinataire.toLowerCase().includes(q)
      );
    }
    return list;
  });

  // KPIs
  totalEmis = computed(() => this.documentsEmis().length);
  totalVises = computed(() => this.documentsEmis().filter(d => d.statut === 'VISE' || d.statut === 'VALIDE').length);
  totalEnAttente = computed(() => this.documentsEmis().filter(d => d.statut === 'EN_ATTENTE').length);

  ngOnInit(): void {
    const emis = this.documentsEmis();
    if (emis.length > 0) {
      this.itemSelectionne.set(emis[0]);
    }
  }

  selectionnerItem(item: DocumentPartageItem): void {
    this.itemSelectionne.set(item);
    if (!item.lu && item.moduleDestinataire === 'RP') {
      this.sharingService.marquerCommeLu(item.id);
    }
  }

  ouvrirModalNouveauPartage(): void {
    this.nouveauPartage.set({
      titre: '',
      reference: 'NTF-RP-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
      typeDocument: 'CONVENTION_PARTENARIAT',
      moduleDestinataire: 'DG',
      destinataireNom: 'Directeur Général',
      typeAction: 'POUR_VISA_SIGNATURE',
      objet: ''
    });
    this.showModalPartage.set(true);
  }

  fermerModalPartage(): void {
    this.showModalPartage.set(false);
  }

  envoyerPartage(): void {
    const form = this.nouveauPartage();
    if (!form.titre.trim() || !form.objet.trim()) {
      this.toast.error('Veuillez renseigner le titre et l\'objet du partage.');
      return;
    }

    const cree = this.sharingService.partagerDocument({
      titre: form.titre.trim(),
      reference: form.reference.trim(),
      typeDocument: form.typeDocument,
      moduleEmetteur: 'RP',
      emetteurNom: 'Chargée des Relations Publiques',
      emetteurMatricule: 'RP001',
      moduleDestinataire: form.moduleDestinataire,
      destinataireNom: form.destinataireNom,
      objet: form.objet.trim(),
      typeAction: form.typeAction
    });

    this.showModalPartage.set(false);
    this.itemSelectionne.set(cree);
  }

  envoyerCommentaire(): void {
    const item = this.itemSelectionne();
    const texte = this.nouveauCommentaireTexte().trim();
    if (!item || !texte) return;

    this.sharingService.ajouterCommentaire(item.id, texte);
    this.nouveauCommentaireTexte.set('');
    // Rafraîchir l'item sélectionné
    const maj = this.sharingService.partages().find(p => p.id === item.id);
    if (maj) this.itemSelectionne.set(maj);
  }

  viserDocument(decision: 'VALIDE' | 'REJETE' | 'VISE'): void {
    const item = this.itemSelectionne();
    if (!item) return;
    this.sharingService.viserDocument(item.id, decision);
    const maj = this.sharingService.partages().find(p => p.id === item.id);
    if (maj) this.itemSelectionne.set(maj);
  }

  ouvrirDansStudio(item: DocumentPartageItem): void {
    this.router.navigate(['/rp/studio-documents']);
  }
}
