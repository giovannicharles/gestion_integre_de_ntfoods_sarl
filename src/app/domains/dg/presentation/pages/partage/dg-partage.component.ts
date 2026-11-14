import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DocumentSharingService, DocumentPartageItem } from '../../../../../shared/document-sharing/document-sharing.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-dg-partage',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './dg-partage.component.html',
  styleUrls: ['./dg-partage.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DgPartageComponent implements OnInit {
  private readonly sharingService = inject(DocumentSharingService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  ongletActif = signal<'RECUS_POUR_VISA' | 'EMIS_PAR_DG'>('RECUS_POUR_VISA');
  filtreStatut = signal<string>('TOUS');
  rechercheTexte = signal<string>('');

  // Dossier sélectionné et fil d'échanges
  itemSelectionne = signal<DocumentPartageItem | null>(null);
  nouveauCommentaireTexte = signal<string>('');

  // Modal Nouvelle Note / Directive DG
  showModalDirective = signal(false);
  nouvelleDirective = signal<{
    titre: string;
    reference: string;
    typeDocument: string;
    moduleDestinataire: string;
    typeAction: 'POUR_VISA_SIGNATURE' | 'POUR_VALIDATION' | 'POUR_INFORMATION' | 'DIFFUSION_URGENTE';
    objet: string;
  }>({
    titre: '',
    reference: 'NTF-DG-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
    typeDocument: 'NOTE_CADRAGE',
    moduleDestinataire: 'TOUS',
    typeAction: 'DIFFUSION_URGENTE',
    objet: ''
  });

  readonly modulesCibles = [
    { code: 'TOUS', label: 'Diffusion Générale (Toutes les directions)' },
    { code: 'RP', label: 'Direction Relations Publiques (RP)' },
    { code: 'COMMERCIAL', label: 'Direction Commerciale' },
    { code: 'CONTROLE', label: 'Contrôle de Gestion & Audit' },
    { code: 'COMPTABLE', label: 'Comptabilité & Finances' },
    { code: 'STOCK', label: 'Stock & Logistique' },
    { code: 'PRODUCTION', label: 'Production Industrielle' },
    { code: 'SECRETAIRE', label: 'Secrétariat Général' }
  ];

  documentsRecusPourDg = computed(() => this.sharingService.obtenirRecusPourModule('DG'));
  directivesEmisesParDg = computed(() => this.sharingService.obtenirEmisParModule('DG'));

  listeAffichee = computed(() => {
    let list = this.ongletActif() === 'RECUS_POUR_VISA' ? this.documentsRecusPourDg() : this.directivesEmisesParDg();
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
        item.moduleEmetteur.toLowerCase().includes(q)
      );
    }
    return list;
  });

  // KPIs Décisionnels DG
  totalEnAttenteSignature = computed(() => this.documentsRecusPourDg().filter(d => d.statut === 'EN_ATTENTE').length);
  totalSignes = computed(() => this.documentsRecusPourDg().filter(d => d.statut === 'VALIDE' || d.statut === 'VISE').length);
  totalDirectives = computed(() => this.directivesEmisesParDg().length);

  ngOnInit(): void {
    const recus = this.documentsRecusPourDg();
    if (recus.length > 0) {
      this.itemSelectionne.set(recus[0]);
    }
  }

  selectionnerItem(item: DocumentPartageItem): void {
    this.itemSelectionne.set(item);
    if (!item.lu && item.moduleDestinataire === 'DG') {
      this.sharingService.marquerCommeLu(item.id);
    }
  }

  ouvrirModalDirective(): void {
    this.nouvelleDirective.set({
      titre: '',
      reference: 'NTF-DG-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
      typeDocument: 'NOTE_CADRAGE',
      moduleDestinataire: 'TOUS',
      typeAction: 'DIFFUSION_URGENTE',
      objet: ''
    });
    this.showModalDirective.set(true);
  }

  fermerModalDirective(): void {
    this.showModalDirective.set(false);
  }

  emettreDirectiveDg(): void {
    const form = this.nouvelleDirective();
    if (!form.titre.trim() || !form.objet.trim()) {
      this.toast.error('Veuillez renseigner le titre et l\'objet de la directive.');
      return;
    }

    const cree = this.sharingService.partagerDocument({
      titre: form.titre.trim(),
      reference: form.reference.trim(),
      typeDocument: form.typeDocument,
      moduleEmetteur: 'DG',
      emetteurNom: 'Directeur Général NT Foods',
      emetteurMatricule: 'DG001',
      moduleDestinataire: form.moduleDestinataire,
      destinataireNom: form.moduleDestinataire === 'TOUS' ? 'Ensemble des départements' : `Direction ${form.moduleDestinataire}`,
      objet: form.objet.trim(),
      typeAction: form.typeAction
    });

    this.showModalDirective.set(false);
    this.itemSelectionne.set(cree);
    this.ongletActif.set('EMIS_PAR_DG');
  }

  apposerVisaOfficiel(decision: 'VALIDE' | 'REJETE' | 'VISE'): void {
    const item = this.itemSelectionne();
    if (!item) return;

    let motif: string | undefined;
    if (decision === 'VALIDE') motif = 'Approuvé par la Direction Générale pour application immédiate.';
    else if (decision === 'REJETE') motif = 'Dossier ajourné par le Directeur Général pour révision budgétaire.';
    else motif = 'Vu et pris en compte par la Direction Générale.';

    this.sharingService.viserDocument(item.id, decision, motif);
    const maj = this.sharingService.partages().find(p => p.id === item.id);
    if (maj) this.itemSelectionne.set(maj);
  }

  envoyerCommentaire(): void {
    const item = this.itemSelectionne();
    const texte = this.nouveauCommentaireTexte().trim();
    if (!item || !texte) return;

    this.sharingService.ajouterCommentaire(item.id, texte);
    this.nouveauCommentaireTexte.set('');
    const maj = this.sharingService.partages().find(p => p.id === item.id);
    if (maj) this.itemSelectionne.set(maj);
  }

  ouvrirDansStudio(item: DocumentPartageItem): void {
    this.router.navigate(['/dg/studio-documents']);
  }
}
