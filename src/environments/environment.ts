/**
 * 2026-10-16 : l'hôte de l'API était figé sur "localhost" — correct depuis le
 * poste de développement lui-même, mais injoignable depuis un téléphone sur le
 * même réseau (son "localhost" désigne le téléphone, pas le poste qui sert
 * l'API). On reprend l'hôte réellement utilisé pour charger la PWA
 * (window.location.hostname) : ouvrir http://<IP-du-poste>:4200 depuis un
 * téléphone fait alors pointer les appels API et le WebSocket de notifications
 * vers http://<IP-du-poste>:8081 automatiquement, sans reconfiguration.
 * Le port de l'API (8081) reste fixe — déployer sur un vrai nom de domaine
 * suppose un reverse proxy ou un environment.prod.ts dédié, pas encore créé.
 */
const apiHost = typeof window !== 'undefined' && window.location?.hostname
  ? window.location.hostname
  : 'localhost';
const apiBase = `http://${apiHost}:8081`;

export const environment = {
  production: false,
  apiUrl: `${apiBase}/api`,
  authUrl: `${apiBase}/api/auth`,
  stockUrl: `${apiBase}/api/stock`,
  // Corrigé 2026-09-22 : pointait vers /api/stock/produits (catalogue TANTY,
  // marque/gamme/variété, enveloppe ApiResponse) alors que ProductService
  // (brands/lines/variants/products/prices) est écrit pour /api/products
  // (ProductManagementController, tableaux bruts, même table que la page
  // Matériels) — la page Gestion Produits était cassée à 100% à cause de
  // cette seule URL.
  productUrl: `${apiBase}/api/products`
};
