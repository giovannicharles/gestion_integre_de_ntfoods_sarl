import { Injectable } from '@angular/core';
import { Product, StockLevel, AlertLevel } from '../models';

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
      SACHET_42G: 42, SEAU_1L: 1000, SEAU_5L: 5000, SEAU_10L: 10000, KG: 1000, GAINE: 420
    };
    const g = grammage[unit] || 1000;
    return Math.floor((kg * 1000) / g);
  }

  // ── CONDITIONNEMENT (Production → Stock) ───────────────────
  // Source: Formation des Commerciaux NTFoods Juin 2022
  // Bouillies: cartons de 25 sachets, étuis (Prestige 200g), seaux (1L/2L/5L)
  // A Grignoter: cartons (30/60/80 sachets mini, 20/24 doypacks moyen, 14 doypacks grand), gaines (10 sachets)
  // CHOCO: boites (1L), seaux (2L/5L/10L)
  // Ingrédients: étuis (200g)
  // Huile: bouteilles (1L), bidons (5L)

  /** Grammage par unité de conditionnement (en grammes). */
  private readonly grammage: Record<string, number> = {
    SACHET_42G: 42,
    SACHET_60G: 60,
    SACHET_62G: 62,
    SEAU_1L: 1000,
    SEAU_2L: 2000,
    SEAU_5L: 5000,
    SEAU_10L: 10000,
    GAINE: 420,       // 1 gaine = 10 sachets × 42g
    ETUI: 200,        // Prestige / Ingrédients culinaires
    BOITE: 1000,      // CHOCO 1L
    BOUTEILLE: 1000,  // Huile 1L
    BIDON: 5000,      // Huile 5L
    DOYPACK_80G: 80,
    DOYPACK_140G: 140,
    DOYPACK_350G: 350,
    KG: 1000,
    LITER: 1000,
  };

  /** Nombre d'unités de base (sachets/seaux) par conditionnement. */
  private readonly unitsPerConditioning: Record<string, number> = {
    SACHET_42G: 1,
    SACHET_60G: 1,
    SACHET_62G: 1,
    SEAU_1L: 1,
    SEAU_2L: 1,
    SEAU_5L: 1,
    SEAU_10L: 1,
    GAINE: 10,        // 1 gaine = 10 sachets
    ETUI: 1,
    BOITE: 1,
    BOUTEILLE: 1,
    BIDON: 1,
    DOYPACK_80G: 1,
    DOYPACK_140G: 1,
    DOYPACK_350G: 1,
    CARTON: 0,        // variable: product.quantityPerCarton
    CARTON_ASSORTI: 0,// variable: product.quantityPerCarton
    SAC: 0,
    KG: 1,
    LITER: 1,
  };

  /** Retourne le label lisible d'un type de conditionnement. */
  getConditioningLabel(type: string): string {
    const labels: Record<string, string> = {
      SACHET_42G: 'Sachet 42g',
      SACHET_60G: 'Sachet 60g',
      SACHET_62G: 'Sachet 62g',
      SEAU_1L: 'Seau 1L',
      SEAU_2L: 'Seau 2L',
      SEAU_5L: 'Seau 5L',
      SEAU_10L: 'Seau 10L',
      GAINE: 'Gaine (10 sachets)',
      CARTON: 'Carton',
      CARTON_ASSORTI: 'Carton d\'assortis',
      ETUI: 'Étui',
      BOITE: 'Boîte',
      BOUTEILLE: 'Bouteille',
      BIDON: 'Bidon',
      DOYPACK_80G: 'Doypack 80g',
      DOYPACK_140G: 'Doypack 140g',
      DOYPACK_350G: 'Doypack 350g',
      SAC: 'Sac',
      KG: 'Kilogramme',
      LITER: 'Litre',
    };
    return labels[type] || type;
  }

  /** Retourne les types de conditionnement disponibles pour un produit. */
  getAvailableConditioningTypes(product: Product): string[] {
    const types: string[] = [];

    // Si le produit a un packagingType défini, l'utiliser comme base
    const pkg = product.packagingType?.toUpperCase();

    // Bouillies en sachets → cartons + cartons d'assortis
    if (product.unit === 'SACHET_42G' || product.unit === 'SACHET_60G' || product.unit === 'SACHET_62G') {
      types.push('CARTON');
      types.push('CARTON_ASSORTI');
    }
    // A Grignoter en sachets → cartons + gaines
    if (pkg === 'SACHET' && product.unit !== 'SACHET_42G' && product.unit !== 'SACHET_60G' && product.unit !== 'SACHET_62G') {
      types.push('CARTON');
      types.push('GAINE');
    }
    // Prestige / Ingrédients culinaires → étuis
    if (pkg === 'ETUI') {
      types.push('ETUI');
    }
    // Doypacks (A Grignoter moyen/grand)
    if (pkg === 'DOYPACK') {
      if (product.unitWeight && Number(product.unitWeight) <= 80) types.push('DOYPACK_80G');
      else if (product.unitWeight && Number(product.unitWeight) <= 140) types.push('DOYPACK_140G');
      else types.push('DOYPACK_350G');
      types.push('CARTON');
    }
    // Seaux (Bouillies, Custard, CHOCO)
    if (product.unit?.startsWith('SEAU_')) {
      types.push(product.unit);
    }
    if (pkg === 'SEAU') {
      if (!types.includes('SEAU_1L')) types.push('SEAU_1L');
      types.push('SEAU_2L');
      types.push('SEAU_5L');
      types.push('SEAU_10L');
    }
    // CHOCO → boites + seaux
    if (pkg === 'BOITE') {
      types.push('BOITE');
    }
    // Huile → bouteilles + bidons
    if (pkg === 'BOUTEILLE') {
      types.push('BOUTEILLE');
    }
    if (pkg === 'BIDON') {
      types.push('BIDON');
    }

    // Fallback: si aucun type trouvé, utiliser l'unité du produit
    if (types.length === 0) {
      types.push(product.unit || 'KG');
    }

    return types;
  }

  /** Retourne le type de conditionnement par défaut pour un produit fini. */
  getConditioningType(product: Product): string {
    const types = this.getAvailableConditioningTypes(product);
    return types[0];
  }

  /** Nombre d'unités de base (sachets/seaux) par unité de conditionnement. */
  getUnitsPerConditioning(conditioningType: string, product?: Product): number {
    if ((conditioningType === 'CARTON' || conditioningType === 'CARTON_ASSORTI') && product?.quantityPerCarton) {
      return product.quantityPerCarton;
    }
    return this.unitsPerConditioning[conditioningType] ?? 1;
  }

  /** Poids en kg d'une unité de conditionnement pour un produit. */
  getConditioningWeightKg(conditioningType: string, product?: Product): number {
    // Carton: utiliser quantityPerCarton × unitWeight du produit
    if ((conditioningType === 'CARTON' || conditioningType === 'CARTON_ASSORTI') && product) {
      const unitsPerCarton = product.quantityPerCarton || 1;
      const unitWeightG = product.unitWeight ? Number(product.unitWeight) : 42;
      return (unitsPerCarton * unitWeightG) / 1000;
    }
    // Doypack: utiliser unitWeight du produit si disponible
    if (conditioningType.startsWith('DOYPACK') && product?.unitWeight) {
      return Number(product.unitWeight) / 1000;
    }
    // Étui: utiliser unitWeight du produit si disponible
    if (conditioningType === 'ETUI' && product?.unitWeight) {
      return Number(product.unitWeight) / 1000;
    }
    const g = this.grammage[conditioningType] ?? 1000;
    return g / 1000;
  }

  /** Convertit une quantité conditionnée en kg. */
  conditioningToKg(qty: number, conditioningType: string, product?: Product): number {
    const weightPerUnit = this.getConditioningWeightKg(conditioningType, product);
    return Math.round(qty * weightPerUnit * 1000) / 1000;
  }

  /** Convertit une quantité conditionnée en unités de base (sachets/seaux individuels). */
  conditioningToUnits(qty: number, conditioningType: string, product?: Product): number {
    const unitsPer = this.getUnitsPerConditioning(conditioningType, product);
    return qty * unitsPer;
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
