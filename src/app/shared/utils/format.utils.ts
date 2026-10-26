export function fCFA(n: number): string {
  return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
}

/** Taux d'atteinte en % ; 0 quand aucun objectif n'est fixé (jamais NaN ni Infinity). */
export function tauxAtteinte(ca: number, objectif: number): number {
  if (!objectif || objectif <= 0 || !Number.isFinite(ca)) return 0;
  return Math.round((ca / objectif) * 100);
}

/** Taux d'atteinte affichable : « — » quand aucun objectif n'est fixé, sinon « 87 % ». */
export function tauxAffiche(ca: number, objectif: number): string {
  return !objectif || objectif <= 0 ? '—' : tauxAtteinte(ca, objectif) + ' %';
}

export function getPrimeEligible(ca: number, objectif: number): boolean {
  return ca >= objectif;
}
