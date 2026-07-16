/**
 * Enveloppe générique renvoyée par TOUS les endpoints du backend Spring Boot.
 * Doit rester strictement alignée sur `ApiResponse<T>` côté serveur.
 */
export interface ApiResponse<T> {
  succes: boolean;
  message?: string;
  donnees?: T;
  erreur?: string;
  horodatage?: string;
}
