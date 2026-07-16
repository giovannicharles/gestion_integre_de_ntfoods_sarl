/**
 * Enveloppe paginée renvoyée par les endpoints backend qui supportent la pagination.
 * Alignée sur `PageResponse<T>` côté serveur (Spring Boot).
 */
export interface PageResponse<T> {
  contenu: T[];
  totalElements: number;
  totalPages: number;
  pageCourante: number;
  taillePage: number;
  dernierePage: boolean;
}

/**
 * Paramètres optionnels de pagination/tri envoyés au backend.
 */
export interface PageParams {
  page?: number;
  size?: number;
  sort?: string;  // ex: "date,desc" ou "horodatage,desc"
}
