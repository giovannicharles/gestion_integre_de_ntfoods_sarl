import { RoleProduction } from './production-role.service';

export interface ProductionNavItem {
  label: string;
  icon: string;
  route: string;
  /** Si renseigné, le badge du menu (nombre) sera calculé par le layout pour cet item. */
  badgeKey?: 'besoinsEnAttente';
}

export interface ProductionRoleConfig {
  /** Libellé affiché dans la sidebar (bloc utilisateur). */
  libelleRole: string;
  /** Route vers laquelle rediriger '/production' pour ce rôle. */
  accueil: string;
  /** Items de menu visibles pour ce rôle, dans l'ordre d'affichage. */
  navItems: ProductionNavItem[];
}

/**
 * Cloisonnement des espaces par rôle : chaque rôle ne voit dans la sidebar
 * que ses propres actions, et atterrit sur son propre tableau de bord.
 *
 * Rôles gérés ici : CHEF_PRODUCTION, RESPONSABLE_SALLE, CHEF_MACHINISTE,
 * AGENT_DOSEUR. GESTIONNAIRE_STOCK n'est PAS pris en charge par ce module —
 * son espace est géré ailleurs dans l'application.
 *
 * DIRECTEUR_GENERAL et ADMIN sont des rôles superviseurs : ils conservent
 * une vue complète (tous les items), car le backend leur ouvre la lecture
 * sur l'ensemble des ressources du module Production.
 */
export const PRODUCTION_ROLE_CONFIG: Record<RoleProduction, ProductionRoleConfig> = {

  CHEF_PRODUCTION: {
    libelleRole: 'Chef de Production',
    accueil: '/production/dashboard',
    navItems: [
      { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/production/dashboard' },
      { label: 'Bons de Commande', icon: 'fa-file-invoice', route: '/production/chef-production/bons-commande' },
      { label: 'Validation des BC', icon: 'fa-stamp', route: '/production/chef-production/validation-bc' },
      { label: 'Plans de Production (PPH)', icon: 'fa-calendar-week', route: '/production/plan' },
      { label: 'Planification', icon: 'fa-calendar-days', route: '/production/chef-production/planification' },
      { label: 'Suivi Global de Production', icon: 'fa-satellite-dish', route: '/production/chef-production/suivi-global' },
      { label: 'Coordination des Acteurs', icon: 'fa-people-arrows', route: '/production/chef-production/coordination' },
      { label: 'Gestion des Ressources', icon: 'fa-boxes-stacked', route: '/production/chef-production/ressources' },
      { label: 'Saisie Journalière', icon: 'fa-pen-to-square', route: '/production/saisie' },
      { label: 'Lots & Conversion', icon: 'fa-industry', route: '/production/lots' },
      { label: 'Registre Employés', icon: 'fa-users', route: '/production/employes' },
      { label: 'Expressions de Besoin', icon: 'fa-triangle-exclamation', route: '/production/besoins', badgeKey: 'besoinsEnAttente' },
      { label: 'Rapports Hebdomadaires', icon: 'fa-file-lines', route: '/production/rapports' },
      { label: 'Analyse des Performances', icon: 'fa-chart-simple', route: '/production/chef-production/performances' },
      { label: 'Statistiques', icon: 'fa-chart-line', route: '/production/chef-production/statistiques' },
      { label: 'Alertes', icon: 'fa-triangle-exclamation', route: '/production/chef-production/alertes' },
      { label: 'Historique et Audit', icon: 'fa-clock-rotate-left', route: '/production/chef-production/historique' },
      { label: 'Téléchargements', icon: 'fa-download', route: '/production/chef-production/telechargements' },
    ],
  },

  RESPONSABLE_SALLE: {
    libelleRole: 'Responsable de Salle',
    accueil: '/production/responsable-salle/dashboard',
    navItems: [
      { label: 'Dashboard', icon: 'fa-gauge-high', route: '/production/responsable-salle/dashboard' },
      { label: 'Bons de Commande', icon: 'fa-file-invoice', route: '/production/responsable-salle/bons-commande' },
      { label: 'Plans de Production (PPH)', icon: 'fa-calendar-week', route: '/production/responsable-salle/plans-pph' },
      { label: 'Ajustement du Plan', icon: 'fa-sliders', route: '/production/responsable-salle/ajustement-plan' },
      { label: 'Affectation des Employés', icon: 'fa-user-gear', route: '/production/responsable-salle/affectation-employes' },
      { label: 'Référentiel des Postes', icon: 'fa-table-list', route: '/production/responsable-salle/referentiel-postes' },
      { label: 'Planning Journalier', icon: 'fa-calendar-day', route: '/production/responsable-salle/planning-journalier' },
      { label: 'Réalisations Journalières', icon: 'fa-pen-to-square', route: '/production/responsable-salle/realisations-poste' },
      { label: 'Production Individuelle', icon: 'fa-user', route: '/production/responsable-salle/production-individuelle' },
      { label: 'Comparaison Doseur / Production', icon: 'fa-scale-balanced', route: '/production/responsable-salle/comparaison-doseur' },
      { label: 'Performances des Postes', icon: 'fa-chart-simple', route: '/production/responsable-salle/performances-postes' },
      { label: 'Classement des Employés', icon: 'fa-trophy', route: '/production/responsable-salle/classement-employes' },
      { label: 'Fiche Info Produit', icon: 'fa-file-lines', route: '/production/responsable-salle/fiche-info-produit' },
      { label: 'Registre Journalier', icon: 'fa-book', route: '/production/responsable-salle/registre-journalier' },
      { label: 'Lots & Conversion', icon: 'fa-industry', route: '/production/lots' },
      { label: 'Registre Employés', icon: 'fa-users', route: '/production/employes' },
      { label: 'Expressions de Besoin', icon: 'fa-triangle-exclamation', route: '/production/besoins', badgeKey: 'besoinsEnAttente' },
      { label: 'Rapports Hebdomadaires', icon: 'fa-file-lines', route: '/production/rapports' },
      { label: 'Statistiques', icon: 'fa-chart-line', route: '/production/responsable-salle/statistiques' },
      { label: 'Téléchargements', icon: 'fa-download', route: '/production/responsable-salle/telechargements' },
    ],
  },

  CHEF_MACHINISTE: {
    libelleRole: 'Chef Machiniste',
    accueil: '/production/chef-machiniste/dashboard',
    navItems: [
      { label: 'Dashboard', icon: 'fa-gauge-high', route: '/production/chef-machiniste/dashboard' },
      { label: 'Plan de Production', icon: 'fa-calendar-week', route: '/production/chef-machiniste/plans' },
      { label: 'Objectifs des Machinistes', icon: 'fa-bullseye', route: '/production/chef-machiniste/objectifs' },
      { label: 'Réalisations Journalières', icon: 'fa-pen-to-square', route: '/production/chef-machiniste/realisations' },
      { label: 'Indicateurs Journaliers', icon: 'fa-clipboard-list', route: '/production/chef-machiniste/indicateurs' },
      { label: 'Suivi des Réalisations', icon: 'fa-eye', route: '/production/chef-machiniste/suivi' },
      { label: 'Performances', icon: 'fa-chart-simple', route: '/production/chef-machiniste/performances' },
      { label: 'Classements', icon: 'fa-trophy', route: '/production/chef-machiniste/classements' },
      { label: 'Statistiques', icon: 'fa-chart-line', route: '/production/chef-machiniste/statistiques' },
      { label: 'Rapports', icon: 'fa-file-lines', route: '/production/chef-machiniste/rapports' },
    ],
  },

  AGENT_DOSEUR: {
    libelleRole: 'Agent Doseur',
    accueil: '/production/agent-doseur/dashboard',
    navItems: [
      { label: 'Dashboard', icon: 'fa-gauge-high', route: '/production/agent-doseur/dashboard' },
      { label: 'Sessions de Production', icon: 'fa-list-check', route: '/production/agent-doseur/sessions' },
      { label: 'Plans de Production', icon: 'fa-calendar-week', route: '/production/agent-doseur/plans' },
      { label: 'Dosage', icon: 'fa-flask', route: '/production/agent-doseur/dosage' },
      { label: 'Mélange', icon: 'fa-blender', route: '/production/agent-doseur/melange' },
      { label: 'Conditionnement des Fûts', icon: 'fa-bottle-droplet', route: '/production/agent-doseur/futs' },
      { label: 'Gestion des Machines', icon: 'fa-gears', route: '/production/agent-doseur/machines' },
      { label: 'Prédictions', icon: 'fa-chart-simple', route: '/production/agent-doseur/predictions' },
      { label: 'Suivi de Production', icon: 'fa-chart-line', route: '/production/agent-doseur/suivi' },
      { label: 'Statistiques', icon: 'fa-chart-column', route: '/production/agent-doseur/statistiques' },
      { label: 'Registre de Dosage', icon: 'fa-book', route: '/production/agent-doseur/registre' },
      { label: 'Documents & Téléchargements', icon: 'fa-download', route: '/production/agent-doseur/documents' },
    ],
  },

  // Rôles superviseurs — accès complet à toutes les pages du module.
  DIRECTEUR_GENERAL: {
    libelleRole: 'Directeur Général',
    accueil: '/production/dashboard',
    navItems: [
      { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/production/dashboard' },
      { label: 'Plan de Production', icon: 'fa-calendar-week', route: '/production/plan' },
      { label: 'Bons de Commande', icon: 'fa-file-invoice', route: '/production/chef-production/bons-commande' },
      { label: 'Suivi Global de Production', icon: 'fa-satellite-dish', route: '/production/chef-production/suivi-global' },
      { label: 'Coordination des Acteurs', icon: 'fa-people-arrows', route: '/production/chef-production/coordination' },
      { label: 'Saisie Journalière', icon: 'fa-pen-to-square', route: '/production/saisie' },
      { label: 'Responsable Salle', icon: 'fa-user-gear', route: '/production/responsable-salle/dashboard' },
      { label: 'Chef Machiniste', icon: 'fa-gears', route: '/production/chef-machiniste/dashboard' },
      { label: 'Agent Doseur', icon: 'fa-flask', route: '/production/agent-doseur/dashboard' },
      { label: 'Lots & Conversion', icon: 'fa-industry', route: '/production/lots' },
      { label: 'Registre Employés', icon: 'fa-users', route: '/production/employes' },
      { label: 'Expressions de Besoin', icon: 'fa-triangle-exclamation', route: '/production/besoins', badgeKey: 'besoinsEnAttente' },
      { label: 'Rapports', icon: 'fa-file-lines', route: '/production/rapports' },
      { label: 'Analyse des Performances', icon: 'fa-chart-simple', route: '/production/chef-production/performances' },
      { label: 'Statistiques', icon: 'fa-chart-line', route: '/production/chef-production/statistiques' },
      { label: 'Alertes', icon: 'fa-triangle-exclamation', route: '/production/chef-production/alertes' },
      { label: 'Historique et Audit', icon: 'fa-clock-rotate-left', route: '/production/chef-production/historique' },
      { label: 'Téléchargements', icon: 'fa-download', route: '/production/chef-production/telechargements' },
    ],
  },

  ADMIN: {
    libelleRole: 'Administrateur',
    accueil: '/production/dashboard',
    navItems: [
      { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/production/dashboard' },
      { label: 'Plan de Production', icon: 'fa-calendar-week', route: '/production/plan' },
      { label: 'Bons de Commande', icon: 'fa-file-invoice', route: '/production/chef-production/bons-commande' },
      { label: 'Suivi Global de Production', icon: 'fa-satellite-dish', route: '/production/chef-production/suivi-global' },
      { label: 'Coordination des Acteurs', icon: 'fa-people-arrows', route: '/production/chef-production/coordination' },
      { label: 'Saisie Journalière', icon: 'fa-pen-to-square', route: '/production/saisie' },
      { label: 'Responsable Salle', icon: 'fa-user-gear', route: '/production/responsable-salle/dashboard' },
      { label: 'Chef Machiniste', icon: 'fa-gears', route: '/production/chef-machiniste/dashboard' },
      { label: 'Agent Doseur', icon: 'fa-flask', route: '/production/agent-doseur/dashboard' },
      { label: 'Lots & Conversion', icon: 'fa-industry', route: '/production/lots' },
      { label: 'Registre Employés', icon: 'fa-users', route: '/production/employes' },
      { label: 'Expressions de Besoin', icon: 'fa-triangle-exclamation', route: '/production/besoins', badgeKey: 'besoinsEnAttente' },
      { label: 'Rapports', icon: 'fa-file-lines', route: '/production/rapports' },
      { label: 'Analyse des Performances', icon: 'fa-chart-simple', route: '/production/chef-production/performances' },
      { label: 'Statistiques', icon: 'fa-chart-line', route: '/production/chef-production/statistiques' },
      { label: 'Alertes', icon: 'fa-triangle-exclamation', route: '/production/chef-production/alertes' },
      { label: 'Historique et Audit', icon: 'fa-clock-rotate-left', route: '/production/chef-production/historique' },
      { label: 'Téléchargements', icon: 'fa-download', route: '/production/chef-production/telechargements' },
    ],
  },
};

/** Menu de repli si le rôle n'a pas pu être résolu, ou n'est pas géré par ce module (ex: GESTIONNAIRE_STOCK). */
export const PRODUCTION_NAV_PAR_DEFAUT: ProductionNavItem[] = [
  { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/production/dashboard' },
];
