export function fCFA(n: number): string {
  return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
}

export function tauxAtteinte(ca: number, objectif: number): number {
  return Math.round((ca / objectif) * 100);
}

export function getPrimeEligible(ca: number, objectif: number): boolean {
  return ca >= objectif;
}
