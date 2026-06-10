import { Injectable } from '@angular/core';
import { Product, StockLevel, AlertLevel } from '../models/stock.models';

/** Service des règles métier pures du domaine TANTY. */
@Injectable({ providedIn: 'root' })
export class StockRulesDomainService {

  /** Détermine si une réception nécessite une 2ème validation (Matières Premières). */
  requiresSecondValidation(warehouseName: string): boolean {
    return warehouseName?.toLowerCase().includes('matières premières') ||
           warehouseName?.toLowerCase().includes('matieres premieres');
  }

  /** Calcule le niveau d'alerte d'un niveau de stock. */
  calcAlertLevel(sl: StockLevel): AlertLevel {
    if (sl.quantity <= sl.safetyStock)  return 'CRITIQUE';
    if (sl.quantity <= sl.reorderPoint) return 'FAIBLE';
    if (sl.quantity >= sl.reorderPoint * 3) return 'SURPLUS';
    return 'NORMAL';
  }

  /** Calcule la date de lot selon la règle TANTY (≤15 → 1er, >15 → 15). */
  calcBatchDate(productionDate: Date): Date {
    const d = new Date(productionDate);
    return d.getDate() <= 15
      ? new Date(d.getFullYear(), d.getMonth(), 1)
      : new Date(d.getFullYear(), d.getMonth(), 15);
  }

  /** Convertit kg en unités selon le type. */
  kgToUnits(kg: number, unit: string): number {
    const grammage: Record<string, number> = {
      SACHET_42G: 42, SEAU_1L: 1000, SEAU_5L: 5000, SEAU_10L: 10000, KG: 1000
    };
    const g = grammage[unit] || 1000;
    return Math.floor((kg * 1000) / g);
  }

  /** Alerte de commande urgente (import Chine : délai > 90j). */
  needsUrgentOrder(sl: StockLevel, leadTimeDays?: number): boolean {
    const delay = leadTimeDays || sl.leadTimeDays || 0;
    const stockMonths = sl.reorderPoint > 0 ? sl.quantity / (sl.reorderPoint / 3) : 999;
    return delay >= 90 && stockMonths < 3;
  }

  /** Formate une valeur en FCFA. */
  formatCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }
}
