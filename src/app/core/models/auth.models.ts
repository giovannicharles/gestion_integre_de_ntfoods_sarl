import { UserRole } from './user.models';

/** Corps attendu par POST /api/auth/login (aligné sur LoginRequest backend). */
export interface LoginRequest {
  matricule: string;
  password: string;
}

/** Réponse de POST /api/auth/login (aligné sur LoginResponse backend). */
export interface LoginResponse {
  token: string;
  matricule: string;
  nomComplet: string;
  role: UserRole;
  expirationMs: number;
}

/** Réponse brute de POST /api/auth/login (utilisée par AuthService). */
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

/** Utilisateur authentifié stocké en local. */
export interface User {
  token: string;
  matricule: string;
  firstname: string;
  lastname: string;
  roles: string[];
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

/** Corps pour POST /api/auth/otp/demander. */
export interface OtpRequest {
  matricule: string;
  raison: string;
}

/** Corps pour POST /api/auth/otp/verifier. */
export interface OtpVerifyRequest {
  matricule: string;
  codeOtp: string;
}
