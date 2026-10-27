import { BesoinEmballageBE, BesoinMatiereBE, TYPES_EMBALLAGE } from './production.service';

/**
 * Utilitaires d'affichage des besoins génériques (matières premières et
 * composants d'emballage) renvoyés par les plans de production. Les noms
 * de matières viennent de la formule de chaque produit (libres, avec ou sans
 * accents) — jamais d'une liste figée maïs/soja/arachide.
 */

function normaliser(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

export function qteMatiere(besoins: BesoinMatiereBE[] | null | undefined, nom: string): number {
  const cle = normaliser(nom);
  return (besoins ?? []).filter(b => normaliser(b.matierePremiere) === cle).reduce((s, b) => s + b.quantiteKg, 0);
}

export function qteEmballage(besoins: BesoinEmballageBE[] | null | undefined, type: string): number {
  return (besoins ?? []).filter(b => b.type === type).reduce((s, b) => s + b.quantite, 0);
}

/** Noms de matières présents dans au moins une des listes, dans l'ordre de première apparition. */
export function nomsMatieres(listes: (BesoinMatiereBE[] | null | undefined)[]): string[] {
  const vus = new Map<string, string>();
  for (const l of listes) for (const b of l ?? []) {
    const cle = normaliser(b.matierePremiere);
    if (!vus.has(cle)) vus.set(cle, b.matierePremiere);
  }
  return [...vus.values()];
}

/** Types d'emballage présents dans au moins une des listes, dans l'ordre de l'enum backend. */
export function typesEmballage(listes: (BesoinEmballageBE[] | null | undefined)[]): string[] {
  const presents = new Set<string>();
  for (const l of listes) for (const b of l ?? []) presents.add(b.type);
  return TYPES_EMBALLAGE.map(t => t.code).filter(c => presents.has(c));
}

export function libelleEmballage(type: string): string {
  return TYPES_EMBALLAGE.find(t => t.code === type)?.libelle ?? type;
}

export function totalKg(besoins: BesoinMatiereBE[] | null | undefined): number {
  return (besoins ?? []).reduce((s, b) => s + b.quantiteKg, 0);
}
