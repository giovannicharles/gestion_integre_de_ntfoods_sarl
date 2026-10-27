/**
 * Filtre de recherche pour les listes de navigation (sidebar + header), 2026-10-25.
 *
 * Insensible à la casse et aux accents : un gestionnaire qui tape "receptions" doit retrouver
 * "Réceptions Fournisseurs" sans avoir à taper l'accent exact.
 */
/**
 * Volontairement sans index signature (2026-10-25) : un index signature rendrait les NavItem[]
 * concrets de chaque layout (icon/badge/badgeClass en plus) incompatibles avec ce type lors de
 * leur passage en `[items]`/`@Input` — erreur TS2345 constatée à la compilation. Seuls `label`
 * et `route` sont nécessaires au filtrage et à la navigation ; les champs additionnels passent
 * tels quels par structural typing, sans qu'il faille les déclarer ici.
 */
export interface NavItemLike {
  label: string;
  route: string;
  icon?: string;
}

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function correspond(label: string, requete: string): boolean {
  const q = normaliser(requete);
  if (!q) return true;
  return normaliser(label).includes(q);
}

/** Filtre une liste plate d'items par libellé. */
export function filtrerNavItems<T extends NavItemLike>(items: T[], requete: string): T[] {
  if (!requete.trim()) return items;
  return items.filter(i => correspond(i.label, requete));
}

export interface NavGroupLike<T extends NavItemLike = NavItemLike> {
  label: string;
  children: T[];
}

/**
 * Filtre une liste de groupes : un groupe reste visible si son propre libellé correspond, ou si
 * au moins un de ses enfants correspond (dans ce cas, seuls les enfants correspondants sont
 * gardés, pour que la recherche ne noie pas le résultat dans des entrées non pertinentes).
 */
export function filtrerNavGroupes<G extends NavGroupLike>(groupes: G[], requete: string): G[] {
  if (!requete.trim()) return groupes;
  return groupes
    .map(g => {
      if (correspond(g.label, requete)) return g;
      const enfants = g.children.filter(c => correspond(c.label, requete));
      return enfants.length > 0 ? { ...g, children: enfants } : null;
    })
    .filter((g): g is G => g !== null);
}
