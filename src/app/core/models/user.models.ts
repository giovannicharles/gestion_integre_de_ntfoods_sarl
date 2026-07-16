export type UserRole =
  | 'DIRECTEUR_GENERAL'
  | 'DIRECTEUR_COMMERCIAL'
  | 'GESTIONNAIRE_STOCK'
  | 'COMMERCIAL'
  | 'COMPTABLE'
  | 'SECRETAIRE'
  | 'ADMIN'
  | 'CHARGEE_RP'
  | 'CHEF_PRODUCTION'
  | 'AGENT_PRODUCTION'
  | 'CHEF_MACHINISTE'
  | 'MACHINISTE'
  | 'AGENT_DOSEUR'
  | 'CONTROLEUR_GENERAL';

/**
 * Mapping des rôles backend (enum Java UserRole avec préfixe ROLE_)
 * vers les rôles frontend (type UserRole sans préfixe).
 */
export const BACKEND_ROLE_MAP: Record<string, UserRole> = {
  ROLE_ADMIN: 'ADMIN',
  ROLE_STOCK: 'GESTIONNAIRE_STOCK',
  ROLE_COMMERCIAL: 'COMMERCIAL',
  ROLE_PRODUCTION: 'CHEF_PRODUCTION',
  ROLE_FINANCE: 'COMPTABLE',
  ROLE_RH: 'SECRETAIRE',
  ROLE_DIRECTION: 'DIRECTEUR_GENERAL',
  ROLE_CAISSIER: 'SECRETAIRE',
  ROLE_MAGASINIER: 'GESTIONNAIRE_STOCK',
  ROLE_VALIDATEUR: 'CONTROLEUR_GENERAL',
};

/** Convertit un rôle backend (string brute reçue de l'API) en UserRole frontend. */
export function mapBackendRole(rawRole: string): UserRole {
  return BACKEND_ROLE_MAP[rawRole] ?? 'ADMIN';
}

export interface AppUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  matricule: string;
  actif: boolean;
  terminalImei?: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  DIRECTEUR_GENERAL: 'Directeur Général',
  DIRECTEUR_COMMERCIAL: 'Directeur Commercial',
  GESTIONNAIRE_STOCK: 'Gestionnaire de Stock',
  COMMERCIAL: 'Commercial Terrain',
  COMPTABLE: 'Comptable',
  SECRETAIRE: 'Secrétaire Caisse',
  ADMIN: 'Administrateur Système',
  CHARGEE_RP: 'Chargée RP & Commercial',
  CHEF_PRODUCTION: 'Chef de Production',
  AGENT_PRODUCTION: 'Agent de Production',
  CHEF_MACHINISTE: 'Chef Machiniste',
  MACHINISTE: 'Machiniste',
  AGENT_DOSEUR: 'Agent Doseur',
  CONTROLEUR_GENERAL: 'Contrôleur Général',
};

export const ROLE_HOMES: Record<UserRole, string> = {
  DIRECTEUR_GENERAL: '/dg/dashboard',
  DIRECTEUR_COMMERCIAL: '/dg/dashboard',
  GESTIONNAIRE_STOCK: '/stock/dashboard',
  COMMERCIAL: '/stock/dashboard',
  COMPTABLE: '/comptable/dashboard',
  SECRETAIRE: '/secretaire/dashboard',
  ADMIN: '/dg/dashboard',
  CHARGEE_RP: '/rp/dashboard',
  CHEF_PRODUCTION: '/production/dashboard',
  AGENT_PRODUCTION: '/production/dashboard',
  CHEF_MACHINISTE: '/production/dashboard',
  MACHINISTE: '/production/dashboard',
  AGENT_DOSEUR: '/production/dashboard',
  CONTROLEUR_GENERAL: '/controle/dashboard',
};

export const ROLE_ICONS: Record<UserRole, string> = {
  DIRECTEUR_GENERAL: 'fa-user-tie',
  DIRECTEUR_COMMERCIAL: 'fa-chart-line',
  GESTIONNAIRE_STOCK: 'fa-warehouse',
  COMMERCIAL: 'fa-truck',
  COMPTABLE: 'fa-calculator',
  SECRETAIRE: 'fa-cash-register',
  ADMIN: 'fa-shield-halved',
  CHARGEE_RP: 'fa-briefcase',
  CHEF_PRODUCTION: 'fa-industry',
  AGENT_PRODUCTION: 'fa-person-digging',
  CHEF_MACHINISTE: 'fa-gears',
  MACHINISTE: 'fa-gear',
  AGENT_DOSEUR: 'fa-screwdriver-wrench',
  CONTROLEUR_GENERAL: 'fa-magnifying-glass-chart',
};
