/**
 * Parseur centralisé des erreurs API — Angular.
 *
 * Lit `erreur` en priorité puis `message` en fallback, exactement
 * comme le backend GlobalExceptionHandler structure ses réponses
 * (ApiResponse.erreur(message, erreur)).
 *
 * Utilisé par tous les composants Angular pour extraire le message
 * précis renvoyé par le backend au lieu d'afficher un message générique.
 */

/**
 * Extrait le message d'erreur depuis une erreur HTTP.
 *
 * @param err L'erreur reçue dans le callback `error` d'un subscribe.
 * @returns Le message d'erreur précis du backend, ou un fallback générique.
 */
export function extractApiError(err: any): string {
  // 423 LOCKED — compte bloqué
  if (err?.status === 423) {
    return err?.error?.erreur || err?.error?.message || 'Votre compte est bloqué, contactez un administrateur.';
  }

  // 401 UNAUTHORIZED
  if (err?.status === 401) {
    return err?.error?.erreur || err?.error?.message || 'Authentification échouée. Veuillez vous reconnecter.';
  }

  // 403 FORBIDDEN
  if (err?.status === 403) {
    return err?.error?.erreur || err?.error?.message || 'Accès refusé : droits insuffisants.';
  }

  // 404 NOT FOUND
  if (err?.status === 404) {
    return err?.error?.erreur || err?.error?.message || 'Ressource introuvable.';
  }

  // 409 CONFLICT
  if (err?.status === 409) {
    return err?.error?.erreur || err?.error?.message || 'Conflit : règle métier violée.';
  }

  // 400 BAD REQUEST
  if (err?.status === 400) {
    return err?.error?.erreur || err?.error?.message || 'Requête invalide.';
  }

  // 500 INTERNAL SERVER ERROR
  if (err?.status === 500) {
    return err?.error?.erreur || err?.error?.message || 'Erreur interne du serveur. Veuillez réessayer plus tard.';
  }

  // Network error (no status)
  if (err?.status === 0) {
    return 'Erreur réseau. Vérifiez votre connexion internet.';
  }

  // Generic fallback — try erreur then message then err.message
  return err?.error?.erreur || err?.error?.message || err?.message || 'Une erreur est survenue. Veuillez réessayer.';
}
