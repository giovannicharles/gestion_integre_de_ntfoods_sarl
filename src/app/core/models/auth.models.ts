import { UserRole } from './user.models';

/** Corps attendu par POST /api/auth/login (aligné sur LoginRequest backend). */
export interface LoginRequest {
  matricule: string;
  password?: string;
  motDePasse?: string;
}

/** Réponse de POST /api/auth/login (aligné sur LoginResponse backend). */
export interface LoginResponse {
  token: string;
  matricule: string;
  nomComplet: string;
  role: UserRole;
  expirationMs: number;
}

/**
 * Lecture tolérante de la réponse de connexion.
 *
 * Le backend émet un rôle unique (`role`), mais des écrans du module production
 * ont été écrits contre une forme tableau (`roles`). Le type admet les deux pour
 * que ces écrans compilent ; `AuthService` normalise vers la forme réellement
 * émise et n'invente jamais de rôle absent de la réponse.
 */
export interface AuthResponse {
  token: string;
  matricule: string;
  nomComplet?: string;
  firstname?: string;
  lastname?: string;
  role?: string;
  roles?: string[];
  expirationMs?: number;
}

/**
 * Utilisateur connecté tel que conservé côté client.
 *
 * `role` est la valeur émise par le backend et fait foi. `roles` en est la forme
 * tableau, dérivée et non saisie : elle existe pour les écrans qui l'attendent,
 * jamais comme seconde source de vérité.
 */
export interface User {
  token: string;
  matricule: string;
  firstname: string;
  lastname: string;
  nomComplet: string;
  role: UserRole;
  roles: UserRole[];
}

/** Corps attendu par POST /api/auth/register (aligné sur RegisterRequest backend). */
export interface RegisterRequest {
  prenom: string;
  nom: string;
  email: string;
  motDePasse: string;
  role: UserRole;
  telephone?: string;
  residence?: string;
  cni?: string;
  photo?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  dateEmbauche?: string;
  sexe?: string;
}

/**
 * Corps pour POST /api/auth/otp/demander.
 *
 * Le double facteur n'est pas activé pour l'instant (voir `AuthService`), mais
 * les routes existent côté serveur et le contrat reste décrit ici : le
 * réactiver ne doit pas demander de le réécrire.
 */
export interface OtpRequest {
  matricule: string;
  raison: string;
}

/** Corps pour POST /api/auth/otp/verifier. */
export interface OtpVerifyRequest {
  matricule: string;
  codeOtp: string;
}
