import { Observable } from 'rxjs';
import {
  Produit, Fournisseur, MouvementStock,
  DashboardStockStats, StockAlert, MagasinType
} from '../models/stock.models';

/**
 * Contrat du repository Stock — Domain Layer (Clean Architecture)
 * Implémenté par l'infrastructure, consommé par les use-cases.
 */
export interface IStockRepository {
  // --- Produits / Inventaire ---
  getProduits(magasin?: MagasinType): Observable<Produit[]>;
  getProduitById(id: string): Observable<Produit>;
  updateStockProduit(id: string, quantite: number): Observable<Produit>;

  // --- Fournisseurs ---
  getFournisseurs(): Observable<Fournisseur[]>;

  // --- Réceptions ---
  getReceptions(): Observable<ReceptionFournisseur[]>;
  getReceptionById(id: string): Observable<ReceptionFournisseur>;
  getReceptionsEnAttente(): Observable<ReceptionFournisseur[]>;
  creerReception(data: Partial<ReceptionFournisseur>): Observable<ReceptionFournisseur>;
  validerGestionnaire(id: string, observations?: string): Observable<ReceptionFournisseur>;
  validerChefProduction(id: string, observations?: string): Observable<ReceptionFournisseur>;
  rejeterReception(id: string, motif: string): Observable<ReceptionFournisseur>;

  // --- Mouvements ---
  getMouvements(): Observable<MouvementStock[]>;
  getMouvementsByProduit(produitId: string): Observable<MouvementStock[]>;

  // --- Dashboard & Alertes ---
  getDashboardStats(): Observable<DashboardStockStats>;
  getAlertes(): Observable<StockAlert[]>;
}

export const STOCK_REPOSITORY_TOKEN = 'IStockRepository';
