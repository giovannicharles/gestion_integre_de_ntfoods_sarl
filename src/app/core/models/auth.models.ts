/**
 * LoginRequest - Interface pour la requête de connexion
 * Correspond au DTO LoginRequest du backend
 */
export interface LoginRequest {
  matricule: string;
  password: string;
}

/**
 * AuthResponse - Interface pour la réponse d'authentification
 * Correspond au DTO AuthResponse du backend
 */
export interface AuthResponse {
  token: string;
  matricule: string;
  firstname: string;
  lastname: string;
  role: string;
}

/**
 * User - Interface pour les informations utilisateur connecté
 */
export interface User {
  matricule: string;
  firstname: string;
  lastname: string;
  role: string;
  token: string;
}
