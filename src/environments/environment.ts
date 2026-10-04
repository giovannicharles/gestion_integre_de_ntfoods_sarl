export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081/api',
  authUrl: 'http://localhost:8081/api/auth',
  stockUrl: 'http://localhost:8081/api/stock',
  // Corrigé 2026-09-22 : pointait vers /api/stock/produits (catalogue TANTY,
  // marque/gamme/variété, enveloppe ApiResponse) alors que ProductService
  // (brands/lines/variants/products/prices) est écrit pour /api/products
  // (ProductManagementController, tableaux bruts, même table que la page
  // Matériels) — la page Gestion Produits était cassée à 100% à cause de
  // cette seule URL.
  productUrl: 'http://localhost:8081/api/products'
};
