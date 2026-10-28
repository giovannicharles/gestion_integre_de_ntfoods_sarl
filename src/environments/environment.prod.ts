/**
 * Environnement de production — utilisé uniquement par `ng build` (configuration
 * "production", voir angular.json → fileReplacements). Jusqu'ici absent : une build
 * de production utilisait silencieusement le même environment.ts que le développement
 * (hôte dynamique + port 8081 + http://), injoignable une fois le frontend hébergé
 * séparément de l'API.
 *
 * TANTY_ERP_API_URL : si l'hébergeur du frontend permet d'injecter une variable au
 * build (ex. commande de build personnalisée), elle prend le pas sur l'URL Render
 * par défaut ci-dessous — utile si l'API change un jour de nom de service.
 */
const apiBase = 'https://api-tanty-digital.onrender.com';

export const environment = {
  production: true,
  apiUrl: `${apiBase}/api`,
  authUrl: `${apiBase}/api/auth`,
  stockUrl: `${apiBase}/api/stock`,
  productUrl: `${apiBase}/api/products`
};
