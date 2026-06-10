import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, delay } from 'rxjs';
import {
  Produit, Fournisseur, ReceptionFournisseur, MouvementStock,
  DashboardStockStats, StockAlert, LigneReception, MagasinType, StatutReception
} from '../../domain/models/stock.models';

@Injectable({ providedIn: 'root' })
export class StockMockService {

  private fournisseurs: Fournisseur[] = [
    { id: 'F001', nom: 'Agri-Cam SARL', pays: 'Cameroun', telephone: '237-690-123-456', email: 'contact@agricam.cm', actif: true },
    { id: 'F002', nom: 'Sinopack Ltd', pays: 'Chine', telephone: '+86-21-5555-0100', email: 'orders@sinopack.cn', actif: true },
    { id: 'F003', nom: 'Cereal Distribution CI', pays: "Côte d'Ivoire", telephone: '225-27-20-330-000', actif: true },
    { id: 'F004', nom: 'Marché de Mfoundi', pays: 'Cameroun', telephone: '237-677-889-900', actif: true },
    { id: 'F005', nom: 'PackagingCo Chine', pays: 'Chine', telephone: '+86-755-8888-9999', email: 'sales@packagingco.cn', actif: true },
  ];

  private produits: Produit[] = [
    { id: 'P001', reference: 'MP-MAIS-001', designation: 'Maïs jaune (grain)', categorie: 'Céréales', unite: 'Kg', magasin: 'MP', stockActuel: 850, stockMinimum: 300, stockMaximum: 2000, stockSecurite: 150, prixUnitaire: 350, niveauAlerte: 'NORMAL', actif: true },
    { id: 'P002', reference: 'MP-SOJA-001', designation: 'Soja décortiqué', categorie: 'Légumineuses', unite: 'Kg', magasin: 'MP', stockActuel: 120, stockMinimum: 200, stockMaximum: 1500, stockSecurite: 100, prixUnitaire: 600, niveauAlerte: 'CRITIQUE', actif: true },
    { id: 'P003', reference: 'MP-ARACH-001', designation: "Poudre d'arachide", categorie: 'Oléagineux', unite: 'Kg', magasin: 'MP', stockActuel: 280, stockMinimum: 150, stockMaximum: 1000, stockSecurite: 80, prixUnitaire: 900, niveauAlerte: 'NORMAL', actif: true },
    { id: 'P004', reference: 'MP-SUCRE-001', designation: 'Sucre cristallisé', categorie: 'Semi-finis', unite: 'Kg', magasin: 'MP', stockActuel: 95, stockMinimum: 100, stockMaximum: 500, stockSecurite: 50, prixUnitaire: 550, niveauAlerte: 'FAIBLE', actif: true },
    { id: 'P005', reference: 'MP-FARIN-001', designation: 'Farine de maïs pré-germé', categorie: 'Semi-finis', unite: 'Kg', magasin: 'MP', stockActuel: 420, stockMinimum: 200, stockMaximum: 1200, stockSecurite: 120, prixUnitaire: 480, niveauAlerte: 'NORMAL', actif: true },
    { id: 'P006', reference: 'MP-ANCHO-001', designation: 'Anchois de Guinée séché', categorie: 'Protéines', unite: 'Kg', magasin: 'MP', stockActuel: 45, stockMinimum: 80, stockMaximum: 300, stockSecurite: 30, prixUnitaire: 2500, niveauAlerte: 'CRITIQUE', actif: true },
    { id: 'P007', reference: 'CONS-SACH-001', designation: 'Sachets 42g TANTY (impression)', categorie: 'Emballages', unite: 'Pièce', magasin: 'CONSOMMABLES', stockActuel: 12500, stockMinimum: 5000, stockMaximum: 50000, stockSecurite: 3000, prixUnitaire: 25, niveauAlerte: 'NORMAL', delaiApprovisionnement: 150, actif: true },
    { id: 'P008', reference: 'CONS-SEAU-001', designation: 'Seaux 1L TANTY', categorie: 'Emballages', unite: 'Pièce', magasin: 'CONSOMMABLES', stockActuel: 2800, stockMinimum: 1000, stockMaximum: 10000, stockSecurite: 600, prixUnitaire: 180, niveauAlerte: 'NORMAL', delaiApprovisionnement: 150, actif: true },
    { id: 'P009', reference: 'CONS-ETIQ-001', designation: 'Étiquettes TBSA (rouleau)', categorie: 'Étiquetage', unite: 'Rouleau', magasin: 'CONSOMMABLES', stockActuel: 18, stockMinimum: 20, stockMaximum: 200, stockSecurite: 10, prixUnitaire: 5500, niveauAlerte: 'FAIBLE', delaiApprovisionnement: 150, actif: true },
    { id: 'P010', reference: 'CONS-CART-001', designation: 'Cartons 24 sachets', categorie: 'Emballages', unite: 'Pièce', magasin: 'CONSOMMABLES', stockActuel: 650, stockMinimum: 300, stockMaximum: 3000, stockSecurite: 200, prixUnitaire: 450, niveauAlerte: 'NORMAL', delaiApprovisionnement: 150, actif: true },
    { id: 'P011', reference: 'PF-TBSA-042', designation: 'TBSA 42g (bouillie vitamine A)', categorie: 'Produits Finis', unite: 'Sachet', magasin: 'PRODUITS_FINIS', stockActuel: 3200, stockMinimum: 500, stockMaximum: 15000, stockSecurite: 300, prixUnitaire: 250, niveauAlerte: 'NORMAL', actif: true },
    { id: 'P012', reference: 'PF-TBSN-042', designation: 'TBSN 42g (bouillie fibres)', categorie: 'Produits Finis', unite: 'Sachet', magasin: 'PRODUITS_FINIS', stockActuel: 1850, stockMinimum: 500, stockMaximum: 15000, stockSecurite: 300, prixUnitaire: 250, niveauAlerte: 'NORMAL', actif: true },
    { id: 'P013', reference: 'PF-TBSP-042', designation: 'TBSP 42g (bouillie calcium)', categorie: 'Produits Finis', unite: 'Sachet', magasin: 'PRODUITS_FINIS', stockActuel: 420, stockMinimum: 500, stockMaximum: 15000, stockSecurite: 300, prixUnitaire: 250, niveauAlerte: 'FAIBLE', actif: true },
    { id: 'P014', reference: 'PF-SEAU1L', designation: 'TANTY Seau 1L classique', categorie: 'Produits Finis', unite: 'Seau', magasin: 'PRODUITS_FINIS', stockActuel: 240, stockMinimum: 100, stockMaximum: 2000, stockSecurite: 60, prixUnitaire: 3500, niveauAlerte: 'NORMAL', actif: true },
  ];

  private receptions: ReceptionFournisseur[] = [
    {
      id: 'REC-001', numeroReception: 'REC-2026-0042',
      fournisseurId: 'F001', fournisseur: this.fournisseurs[0],
      bonCommandeNumero: 'BC-2026-0018',
      dateReception: new Date('2026-05-07T08:30:00'),
      magasin: 'MP', emplacement: 'Zone A - Étagère 3',
      lignes: [
        { id: 'L001', produitId: 'P001', produit: this.produits[0], quantiteCommandee: 500, quantiteRecue: 490, ecart: -10, motifEcart: 'Sacs légèrement sous-remplis à la source', prixUnitaire: 350, montantTotal: 171500, lotNumero: 'LOT-MAI-2605', observations: 'Qualité satisfaisante' },
        { id: 'L002', produitId: 'P003', produit: this.produits[2], quantiteCommandee: 150, quantiteRecue: 150, ecart: 0, prixUnitaire: 900, montantTotal: 135000, lotNumero: 'LOT-ARA-2605' },
      ],
      statut: 'EN_ATTENTE', creeParId: 'U001', creePar: 'Mvondo Jean-Baptiste',
      creeLe: new Date('2026-05-07T08:30:00'), montantTotal: 306500
    },
    {
      id: 'REC-002', numeroReception: 'REC-2026-0041',
      fournisseurId: 'F002', fournisseur: this.fournisseurs[1],
      bonCommandeNumero: 'BC-2026-0015',
      dateReception: new Date('2026-05-06T14:00:00'),
      magasin: 'CONSOMMABLES', emplacement: 'Magasin Consommables - Allée B',
      lignes: [
        { id: 'L003', produitId: 'P007', produit: this.produits[6], quantiteCommandee: 10000, quantiteRecue: 10000, ecart: 0, prixUnitaire: 25, montantTotal: 250000, lotNumero: 'SINO-SACH-0526' },
        { id: 'L004', produitId: 'P008', produit: this.produits[7], quantiteCommandee: 500, quantiteRecue: 480, ecart: -20, motifEcart: 'Casse durant le transport maritime', prixUnitaire: 180, montantTotal: 86400, observations: 'Déclarer à assurance' },
      ],
      statut: 'VALIDE_GESTIONNAIRE',
      validePar: 'Mvondo Jean-Baptiste', dateValidationGestionnaire: new Date('2026-05-06T16:00:00'),
      creeParId: 'U001', creePar: 'Mvondo Jean-Baptiste',
      creeLe: new Date('2026-05-06T14:00:00'), montantTotal: 336400
    },
    {
      id: 'REC-003', numeroReception: 'REC-2026-0040',
      fournisseurId: 'F003', fournisseur: this.fournisseurs[2],
      bonCommandeNumero: 'BC-2026-0014',
      dateReception: new Date('2026-05-05T10:15:00'),
      magasin: 'MP',
      lignes: [
        { id: 'L005', produitId: 'P002', produit: this.produits[1], quantiteCommandee: 300, quantiteRecue: 305, ecart: 5, motifEcart: 'Surplus non facturé — à vérifier avec fournisseur', prixUnitaire: 600, montantTotal: 183000, lotNumero: 'SOJA-CI-0505' },
      ],
      statut: 'VALIDE_CHEF_PROD',
      validePar: 'Mvondo Jean-Baptiste', dateValidationGestionnaire: new Date('2026-05-05T11:00:00'),
      valideParChefProd: 'M. Clive Nkomo', dateValidationChefProd: new Date('2026-05-05T13:30:00'),
      creeParId: 'U001', creePar: 'Mvondo Jean-Baptiste',
      creeLe: new Date('2026-05-05T10:15:00'), montantTotal: 183000
    },
    {
      id: 'REC-004', numeroReception: 'REC-2026-0039',
      fournisseurId: 'F004', fournisseur: this.fournisseurs[3],
      dateReception: new Date('2026-05-04T09:00:00'),
      magasin: 'MP',
      lignes: [
        { id: 'L006', produitId: 'P004', produit: this.produits[3], quantiteCommandee: 100, quantiteRecue: 100, ecart: 0, prixUnitaire: 550, montantTotal: 55000 },
        { id: 'L007', produitId: 'P006', produit: this.produits[5], quantiteCommandee: 30, quantiteRecue: 28, ecart: -2, motifEcart: 'Manque constaté à la livraison', prixUnitaire: 2500, montantTotal: 70000 },
      ],
      statut: 'VALIDE_CHEF_PROD',
      validePar: 'Mvondo Jean-Baptiste', dateValidationGestionnaire: new Date('2026-05-04T10:00:00'),
      valideParChefProd: 'M. Clive Nkomo', dateValidationChefProd: new Date('2026-05-04T14:00:00'),
      creeParId: 'U001', creePar: 'Mvondo Jean-Baptiste',
      creeLe: new Date('2026-05-04T09:00:00'), montantTotal: 125000
    },
    {
      id: 'REC-005', numeroReception: 'REC-2026-0038',
      fournisseurId: 'F001', fournisseur: this.fournisseurs[0],
      bonCommandeNumero: 'BC-2026-0012',
      dateReception: new Date('2026-05-03T08:00:00'),
      magasin: 'MP',
      lignes: [
        { id: 'L008', produitId: 'P001', produit: this.produits[0], quantiteCommandee: 400, quantiteRecue: 400, ecart: 0, prixUnitaire: 345, montantTotal: 138000, lotNumero: 'LOT-MAI-0305' },
      ],
      statut: 'VALIDE_CHEF_PROD',
      validePar: 'Mvondo Jean-Baptiste',
      valideParChefProd: 'M. Clive Nkomo',
      creeParId: 'U001', creePar: 'Mvondo Jean-Baptiste',
      creeLe: new Date('2026-05-03T08:00:00'), montantTotal: 138000
    },
  ];

  private mouvements: MouvementStock[] = [
    { id: 'M001', type: 'ENTREE_FOURNISSEUR', produitId: 'P001', produit: this.produits[0], quantite: 490, quantiteAvant: 360, quantiteApres: 850, receptionId: 'REC-001', reference: 'REC-2026-0042', date: new Date('2026-05-07T08:30:00'), effectuePar: 'Mvondo Jean-Baptiste' },
    { id: 'M002', type: 'SORTIE_PRODUCTION', produitId: 'P001', produit: this.produits[0], quantite: 120, quantiteAvant: 850, quantiteApres: 730, date: new Date('2026-05-07T07:00:00'), effectuePar: 'M. Clive Nkomo', reference: 'PROD-2026-0301' },
    { id: 'M003', type: 'ENTREE_FOURNISSEUR', produitId: 'P007', produit: this.produits[6], quantite: 10000, quantiteAvant: 2500, quantiteApres: 12500, receptionId: 'REC-002', reference: 'REC-2026-0041', date: new Date('2026-05-06T14:00:00'), effectuePar: 'Mvondo Jean-Baptiste' },
    { id: 'M004', type: 'SORTIE_PRODUCTION', produitId: 'P002', produit: this.produits[1], quantite: 80, quantiteAvant: 200, quantiteApres: 120, date: new Date('2026-05-06T06:30:00'), effectuePar: 'M. Clive Nkomo', reference: 'PROD-2026-0300' },
    { id: 'M005', type: 'SORTIE_COMMERCIAL', produitId: 'P011', produit: this.produits[10], quantite: 240, quantiteAvant: 3440, quantiteApres: 3200, date: new Date('2026-05-07T06:00:00'), effectuePar: 'Mvondo Jean-Baptiste', reference: 'CHARG-2026-0215' },
  ];

  getStats(): Observable<DashboardStockStats> {
    const alertesCritiques = this.produits.filter(p => p.niveauAlerte === 'CRITIQUE').length;
    const alertesFaibles = this.produits.filter(p => p.niveauAlerte === 'FAIBLE').length;
    const receptionsEnAttente = this.receptions.filter(r => r.statut === 'EN_ATTENTE' || r.statut === 'VALIDE_GESTIONNAIRE').length;
    const today = new Date().toDateString();
    const receptionsAujourdhui = this.receptions.filter(r => new Date(r.creeLe).toDateString() === today).length;
    const mouvementsAujourdhui = this.mouvements.filter(m => new Date(m.date).toDateString() === today).length;
    const totalValeur = this.produits.reduce((acc, p) => acc + (p.stockActuel * p.prixUnitaire), 0);

    return of({
      totalProduits: this.produits.length,
      totalValeurStock: totalValeur,
      alertesCritiques,
      alertesFaibles,
      receptionsEnAttente,
      receptionsAujourdhui,
      mouvementsAujourdhui,
      tauxRotation: 4.2
    }).pipe(delay(200));
  }

  getAlertes(): Observable<StockAlert[]> {
    const alertes = this.produits
      .filter(p => p.niveauAlerte === 'CRITIQUE' || p.niveauAlerte === 'FAIBLE')
      .map(p => ({ produitId: p.id, designation: p.designation, magasin: p.magasin, stockActuel: p.stockActuel, stockMinimum: p.stockMinimum, niveau: p.niveauAlerte }));
    return of(alertes).pipe(delay(100));
  }

  getProduits(magasin?: MagasinType): Observable<Produit[]> {
    const result = magasin ? this.produits.filter(p => p.magasin === magasin) : this.produits;
    return of(result).pipe(delay(150));
  }

  getFournisseurs(): Observable<Fournisseur[]> {
    return of(this.fournisseurs).pipe(delay(100));
  }

  getReceptions(): Observable<ReceptionFournisseur[]> {
    return of([...this.receptions].sort((a, b) => new Date(b.creeLe).getTime() - new Date(a.creeLe).getTime())).pipe(delay(200));
  }

  getReceptionsEnAttente(): Observable<ReceptionFournisseur[]> {
    return of(this.receptions.filter(r => r.statut === 'EN_ATTENTE' || r.statut === 'VALIDE_GESTIONNAIRE')).pipe(delay(150));
  }

  getMouvements(): Observable<MouvementStock[]> {
    return of([...this.mouvements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())).pipe(delay(150));
  }

  creerReception(data: Partial<ReceptionFournisseur>): Observable<ReceptionFournisseur> {
    const newRec: ReceptionFournisseur = {
      id: 'REC-' + Date.now(),
      numeroReception: 'REC-2026-00' + (this.receptions.length + 43),
      fournisseurId: data.fournisseurId!,
      fournisseur: this.fournisseurs.find(f => f.id === data.fournisseurId),
      bonCommandeNumero: data.bonCommandeNumero,
      dateReception: new Date(),
      magasin: data.magasin!,
      emplacement: data.emplacement,
      lignes: data.lignes || [],
      statut: 'EN_ATTENTE',
      creeParId: 'U001',
      creePar: 'Mvondo Jean-Baptiste',
      creeLe: new Date(),
      montantTotal: data.lignes?.reduce((acc, l) => acc + l.montantTotal, 0) || 0,
      observationsGestionnaire: data.observationsGestionnaire
    };
    this.receptions.unshift(newRec);
    return of(newRec).pipe(delay(500));
  }

  validerReceptionGestionnaire(id: string, observations?: string): Observable<ReceptionFournisseur> {
    const rec = this.receptions.find(r => r.id === id);
    if (rec) {
      rec.statut = 'VALIDE_GESTIONNAIRE';
      rec.validePar = 'Mvondo Jean-Baptiste';
      rec.dateValidationGestionnaire = new Date();
      rec.observationsGestionnaire = observations;
    }
    return of(rec!).pipe(delay(300));
  }

  validerReceptionChefProd(id: string, observations?: string): Observable<ReceptionFournisseur> {
    const rec = this.receptions.find(r => r.id === id);
    if (rec) {
      rec.statut = 'VALIDE_CHEF_PROD';
      rec.valideParChefProd = 'M. Clive Nkomo';
      rec.dateValidationChefProd = new Date();
      rec.observationsChefProd = observations;
      // Update stock for MP entries
      rec.lignes.forEach(ligne => {
        const produit = this.produits.find(p => p.id === ligne.produitId);
        if (produit) {
          const avant = produit.stockActuel;
          produit.stockActuel += ligne.quantiteRecue;
          produit.niveauAlerte = this.calcNiveauAlerte(produit);
          const mouvement: MouvementStock = {
            id: 'M' + Date.now(),
            type: 'ENTREE_FOURNISSEUR',
            produitId: produit.id,
            produit,
            quantite: ligne.quantiteRecue,
            quantiteAvant: avant,
            quantiteApres: produit.stockActuel,
            receptionId: rec.id,
            reference: rec.numeroReception,
            date: new Date(),
            effectuePar: 'M. Clive Nkomo'
          };
          this.mouvements.unshift(mouvement);
        }
      });
    }
    return of(rec!).pipe(delay(300));
  }

  rejeterReception(id: string, motif: string): Observable<ReceptionFournisseur> {
    const rec = this.receptions.find(r => r.id === id);
    if (rec) { rec.statut = 'REJETE'; rec.observationsChefProd = motif; }
    return of(rec!).pipe(delay(300));
  }

  private calcNiveauAlerte(p: Produit): any {
    if (p.stockActuel <= p.stockSecurite) return 'CRITIQUE';
    if (p.stockActuel <= p.stockMinimum) return 'FAIBLE';
    if (p.stockActuel >= p.stockMaximum * 0.9) return 'SURPLUS';
    return 'NORMAL';
  }
}
