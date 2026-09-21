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
  | 'RESPONSABLE_SALLE'
  | 'AGENT_PRODUCTION'
  | 'CHEF_MACHINISTE'
  | 'MACHINISTE'
  | 'AGENT_DOSEUR'
  | 'CONTROLEUR_GENERAL';

/**
 * Correspondance entre les rôles émis par le backend (`Role.java`) et les rôles
 * connus du client.
 *
 * Les quinze valeurs de l'énumération Java y figurent. `AGENT_PRODUCTION` était
 * jusqu'ici absent côté web alors que le backend le déclare : un agent de
 * production connecté n'était donc reconnu par aucun écran.
 */
export const BACKEND_ROLE_MAP: Record<string, UserRole> = {
  ADMIN: 'ADMIN',
  DIRECTEUR_GENERAL: 'DIRECTEUR_GENERAL',
  DIRECTEUR_COMMERCIAL: 'DIRECTEUR_COMMERCIAL',
  GESTIONNAIRE_STOCK: 'GESTIONNAIRE_STOCK',
  COMMERCIAL: 'COMMERCIAL',
  CHEF_PRODUCTION: 'CHEF_PRODUCTION',
  RESPONSABLE_SALLE: 'RESPONSABLE_SALLE',
  CHEF_MACHINISTE: 'CHEF_MACHINISTE',
  MACHINISTE: 'MACHINISTE',
  AGENT_DOSEUR: 'AGENT_DOSEUR',
  AGENT_PRODUCTION: 'AGENT_PRODUCTION',
  CONTROLEUR_GENERAL: 'CONTROLEUR_GENERAL',
  SECRETAIRE: 'SECRETAIRE',
  COMPTABLE: 'COMPTABLE',
  CHARGEE_RP: 'CHARGEE_RP',
};

/**
 * Correspondance inverse : libellés français/anglais parfois renvoyés par
 * certains endpoints ou historiques de données vers le rôle client canonique.
 * Permet d'éviter un Forbidden lorsque le backend émet le libellé (ex. "Secrétaire")
 * au lieu du nom de l'énumération Java ("SECRETAIRE").
 */
export const BACKEND_ROLE_LABEL_MAP: Record<string, UserRole> = {
  'Directeur Général': 'DIRECTEUR_GENERAL',
  'Directeur Commercial': 'DIRECTEUR_COMMERCIAL',
  'Gestionnaire de Stock': 'GESTIONNAIRE_STOCK',
  Commercial: 'COMMERCIAL',
  Comptable: 'COMPTABLE',
  Secrétaire: 'SECRETAIRE',
  "Secrétaire Caisse": 'SECRETAIRE',
  'Administrateur Système': 'ADMIN',
  'Chargée RP & Commercial': 'CHARGEE_RP',
  'Chargée RP': 'CHARGEE_RP',
  'Chef de Production': 'CHEF_PRODUCTION',
  'Responsable de Salle': 'RESPONSABLE_SALLE',
  'responsable de salle': 'RESPONSABLE_SALLE',
  'Chef Machiniste': 'CHEF_MACHINISTE',
  Machiniste: 'MACHINISTE',
  'Agent Doseur': 'AGENT_DOSEUR',
  'Agent Production': 'AGENT_PRODUCTION',
  'Contrôleur Général': 'CONTROLEUR_GENERAL',
};

/**
 * Normalise une chaîne brute pour la comparaison de rôles.
 * Supprime les espaces superflus, retire les accents et passe en majuscules.
 */
function normalizeRole(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convertit un rôle backend en rôle client, ou renvoie `null` s'il est inconnu.
 *
 * Le repli sur `'ADMIN'` que portait la version précédente donnait à tout rôle
 * non reconnu la navigation d'un administrateur. Le backend continuait certes
 * d'appliquer ses propres autorisations, mais un défaut de correspondance ne
 * doit jamais élargir un accès : il doit le refuser. Le `null` remonte donc à
 * l'appelant, qui décide — et aucun appelant n'a le droit de le remplacer par
 * un rôle privilégié.
 *
 * La recherche accepte maintenant trois formes :
 * 1. le nom exact de l'énumération Java (ex. "SECRETAIRE") ;
 * 2. le libellé affiché (ex. "Secrétaire") ;
 * 3. une forme normalisée sans accent ni casse (ex. "secretaire").
 */
export function mapBackendRole(rawRole: string): UserRole | null {
  if (!rawRole) return null;
  const trimmed = rawRole.trim();

  // 1. Correspondance exacte avec le nom de l'énumération Java.
  if (BACKEND_ROLE_MAP[trimmed]) {
    return BACKEND_ROLE_MAP[trimmed];
  }

  // 2. Correspondance avec un libellé connu (ex. "Secrétaire").
  if (BACKEND_ROLE_LABEL_MAP[trimmed]) {
    return BACKEND_ROLE_LABEL_MAP[trimmed];
  }

  // 3. Correspondance insensible à la casse et aux accents.
  const normalized = normalizeRole(trimmed);
  const byNormalized = Object.entries(BACKEND_ROLE_MAP).find(
    ([key]) => normalizeRole(key) === normalized
  );
  if (byNormalized) {
    return byNormalized[1];
  }

  return null;
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
  RESPONSABLE_SALLE: 'Responsable de Salle',
  AGENT_PRODUCTION: 'Agent de Production',
  CHEF_MACHINISTE: 'Chef Machiniste',
  MACHINISTE: 'Machiniste',
  AGENT_DOSEUR: 'Agent Doseur',
  CONTROLEUR_GENERAL: 'Contrôleur Général',
};

/**
 * Écran d'accueil de chaque rôle.
 *
 * `COMMERCIAL` pointe volontairement vers l'écran de connexion : le commercial
 * terrain travaille sur le terminal mobile, et `authGuard` le refuse sur le web.
 * Lui donner ici un accueil applicatif rétablirait par la redirection l'accès
 * que le garde refuse par la porte.
 */
export const ROLE_HOMES: Record<UserRole, string> = {
  DIRECTEUR_GENERAL: '/dg/dashboard',
  DIRECTEUR_COMMERCIAL: '/dg/dashboard',
  GESTIONNAIRE_STOCK: '/stock/dashboard',
  COMMERCIAL: '/auth/login',
  COMPTABLE: '/comptable/dashboard',
  SECRETAIRE: '/secretaire/dashboard',
  ADMIN: '/dg/dashboard',
  CHARGEE_RP: '/rp/dashboard',
  CHEF_PRODUCTION: '/production/dashboard',
  RESPONSABLE_SALLE: '/production/dashboard',
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
  RESPONSABLE_SALLE: 'fa-person-digging',
  AGENT_PRODUCTION: 'fa-person-digging',
  CHEF_MACHINISTE: 'fa-gears',
  MACHINISTE: 'fa-gear',
  AGENT_DOSEUR: 'fa-screwdriver-wrench',
  CONTROLEUR_GENERAL: 'fa-magnifying-glass-chart',
};
