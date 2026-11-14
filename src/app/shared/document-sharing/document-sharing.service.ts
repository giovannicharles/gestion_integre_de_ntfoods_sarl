import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';

export interface DocumentPartageCommentaire {
  id: string;
  auteurMatricule: string;
  auteurNom: string;
  auteurRole: string;
  date: string;
  message: string;
}

export interface DocumentPartageItem {
  id: string;
  titre: string;
  reference: string;
  typeDocument: string;
  moduleEmetteur: string;
  emetteurNom: string;
  emetteurMatricule: string;
  moduleDestinataire: string; // 'DG' | 'CONTROLE' | 'COMMERCIAL' | 'COMPTABLE' | 'PRODUCTION' | 'STOCK' | 'RP' | 'TOUS'
  destinataireNom?: string;
  datePartage: string;
  objet: string;
  typeAction: 'POUR_INFORMATION' | 'POUR_VISA_SIGNATURE' | 'POUR_VALIDATION' | 'POUR_COMMENTAIRE' | 'DIFFUSION_URGENTE';
  statut: 'EN_ATTENTE' | 'LU' | 'VISE' | 'VALIDE' | 'REJETE';
  visaDate?: string;
  visePar?: string;
  contenuDocumentJson?: string;
  commentaires: DocumentPartageCommentaire[];
  lu: boolean;
}

const STORAGE_PARTAGES_KEY = 'tanty_documents_partages_db';

@Injectable({ providedIn: 'root' })
export class DocumentSharingService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly _partages = signal<DocumentPartageItem[]>([]);
  readonly partages = this._partages.asReadonly();

  constructor() {
    this.charger();
  }

  charger(): void {
    const saved = localStorage.getItem(STORAGE_PARTAGES_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this._partages.set(parsed);
          return;
        }
      } catch (_) {}
    }
    // Données initiales d'exemple pour la communication inter-modules
    const init: DocumentPartageItem[] = [
      {
        id: 'PRT-2026-001',
        titre: 'Convention Cadre Référencement GMS - Supermarchés DOVV 2026',
        reference: 'NTF-RP-2026-DOVV-01',
        typeDocument: 'CONVENTION_PARTENARIAT',
        moduleEmetteur: 'RP',
        emetteurNom: 'Chargée des Relations Publiques',
        emetteurMatricule: 'RP001',
        moduleDestinataire: 'DG',
        destinataireNom: 'Directeur Général',
        datePartage: new Date(Date.now() - 24 * 3600000).toISOString(),
        objet: 'Transmission de l\'accord négocié pour les magasins de Yaoundé (remise 10% sur Tapioca 1kg, 350 cartons/mois). Visa DG requis.',
        typeAction: 'POUR_VISA_SIGNATURE',
        statut: 'VISE',
        visaDate: new Date(Date.now() - 12 * 3600000).toISOString(),
        visePar: 'Directeur Général',
        lu: true,
        commentaires: [
          {
            id: 'c1',
            auteurMatricule: 'DG001',
            auteurNom: 'Directeur Général',
            auteurRole: 'DG',
            date: new Date(Date.now() - 12 * 3600000).toISOString(),
            message: 'Accord validé. Veiller à ce que la livraison initiale se fasse en début de semaine.'
          }
        ]
      },
      {
        id: 'PRT-2026-002',
        titre: 'Bilan d\'Impact & ROI Campagne Dégustation Carrefour Warda',
        reference: 'NTF-RP-2026-CAMP-04',
        typeDocument: 'BILAN_CAMPAGNE',
        moduleEmetteur: 'RP',
        emetteurNom: 'Chargée des Relations Publiques',
        emetteurMatricule: 'RP001',
        moduleDestinataire: 'CONTROLE',
        destinataireNom: 'Contrôle de Gestion',
        datePartage: new Date(Date.now() - 48 * 3600000).toISOString(),
        objet: 'Bilan financier de l\'animation week-end : budget engagé 250 000 FCFA pour 1 200 000 FCFA de ventes générées (+380% ROI).',
        typeAction: 'POUR_INFORMATION',
        statut: 'LU',
        lu: true,
        commentaires: [
          {
            id: 'c2',
            auteurMatricule: 'CG001',
            auteurNom: 'Contrôleur de Gestion',
            auteurRole: 'CONTROLEUR_GENERAL',
            date: new Date(Date.now() - 36 * 3600000).toISOString(),
            message: 'Excellente rentabilité opérationnelle, budget d\'hôtesses conforme au devis initial.'
          }
        ]
      }
    ];
    this._partages.set(init);
    this.sauvegarder(init);
  }

  private sauvegarder(items: DocumentPartageItem[]): void {
    this._partages.set(items);
    localStorage.setItem(STORAGE_PARTAGES_KEY, JSON.stringify(items));
  }

  partagerDocument(item: Omit<DocumentPartageItem, 'id' | 'datePartage' | 'statut' | 'commentaires' | 'lu'>): DocumentPartageItem {
    const user = this.auth.getCurrentUser();
    const nouveau: DocumentPartageItem = {
      ...item,
      id: 'PRT-' + Date.now(),
      datePartage: new Date().toISOString(),
      statut: 'EN_ATTENTE',
      emetteurMatricule: user?.matricule || item.emetteurMatricule || 'RP001',
      emetteurNom: user ? `${user.firstname} ${user.lastname}` : item.emetteurNom,
      commentaires: [],
      lu: false
    };

    const maj = [nouveau, ...this._partages()];
    this.sauvegarder(maj);
    this.toast.success(`Document « ${nouveau.titre} » transmis avec succès au module ${nouveau.moduleDestinataire}.`);
    return nouveau;
  }

  marquerCommeLu(id: string): void {
    const maj = this._partages().map(p => p.id === id ? { ...p, lu: true, statut: p.statut === 'EN_ATTENTE' ? 'LU' as const : p.statut } : p);
    this.sauvegarder(maj);
  }

  viserDocument(id: string, decision: 'VALIDE' | 'REJETE' | 'VISE', commentaire?: string): void {
    const user = this.auth.getCurrentUser();
    const nomSignataire = user ? `${user.firstname} ${user.lastname}` : 'Direction';

    const maj = this._partages().map(p => {
      if (p.id !== id) return p;
      const coms = [...p.commentaires];
      if (commentaire && commentaire.trim()) {
        coms.push({
          id: 'com-' + Date.now(),
          auteurMatricule: user?.matricule || 'USER',
          auteurNom: nomSignataire,
          auteurRole: user?.roles?.[0] || 'RESPONSABLE',
          date: new Date().toISOString(),
          message: commentaire.trim()
        });
      }
      return {
        ...p,
        statut: decision,
        visaDate: new Date().toISOString(),
        visePar: nomSignataire,
        lu: true,
        commentaires: coms
      };
    });

    this.sauvegarder(maj);
    this.toast.success(`Document ${decision === 'VALIDE' ? 'approuvé et visé' : decision === 'REJETE' ? 'rejeté' : 'visé'} avec succès.`);
  }

  ajouterCommentaire(id: string, message: string): void {
    if (!message.trim()) return;
    const user = this.auth.getCurrentUser();
    const nouveauCom: DocumentPartageCommentaire = {
      id: 'com-' + Date.now(),
      auteurMatricule: user?.matricule || 'USER',
      auteurNom: user ? `${user.firstname} ${user.lastname}` : 'Collaborateur',
      auteurRole: user?.roles?.[0] || 'RP',
      date: new Date().toISOString(),
      message: message.trim()
    };

    const maj = this._partages().map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        commentaires: [...p.commentaires, nouveauCom]
      };
    });

    this.sauvegarder(maj);
    this.toast.success('Commentaire ajouté au fil de discussion.');
  }

  obtenirRecusPourModule(module: string): DocumentPartageItem[] {
    return this._partages().filter(p => p.moduleDestinataire === module || p.moduleDestinataire === 'TOUS');
  }

  obtenirEmisParModule(module: string): DocumentPartageItem[] {
    return this._partages().filter(p => p.moduleEmetteur === module);
  }
}
