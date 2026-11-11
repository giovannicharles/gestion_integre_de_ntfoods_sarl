/**
 * Parseur centralisé des erreurs API, Angular.
 *
 * Lit `erreur` en priorité puis `message` en fallback, exactement
 * comme le backend GlobalExceptionHandler structure ses réponses
 * (ApiResponse.erreur(message, erreur)), et extrait également les
 * erreurs de validation par champ (`details`, `errors`, `fieldErrors`)
 * ainsi que l'identifiant de trace éventuel (`traceId`).
 */

export interface ParsedApiError {
  status: number;
  message: string;
  fieldErrors: Record<string, string>;
  traceId?: string;
  isNetworkError: boolean;
}

/**
 * Analyse complète d'une erreur HTTP en structure exploitable par les formulaires et les toasts.
 */
export function parseApiErrorDetail(err: any): ParsedApiError {
  const status = typeof err?.status === 'number' ? err.status : -1;
  const body = err?.error;
  const fieldErrors: Record<string, string> = {};

  if (body && typeof body === 'object') {
    const rawDetails = body.details || body.fieldErrors || body.errors;
    if (Array.isArray(rawDetails)) {
      for (const item of rawDetails) {
        const key = item?.champ || item?.field || item?.property;
        const msg = item?.message || item?.defaultMessage || item?.erreur;
        if (key && msg) {
          fieldErrors[String(key)] = String(msg);
        }
      }
    } else if (rawDetails && typeof rawDetails === 'object') {
      for (const [k, v] of Object.entries(rawDetails)) {
        if (typeof v === 'string') {
          fieldErrors[k] = v;
        }
      }
    }
  }

  return {
    status,
    message: extractApiError(err),
    fieldErrors,
    traceId: body?.traceId || err?.headers?.get?.('X-Trace-Id') || undefined,
    isNetworkError: status === 0 || status === -1 || status === 504
  };
}

/**
 * Extrait le message d'erreur lisible en français depuis une erreur HTTP.
 *
 * @param err L'erreur reçue dans le callback `error` d'un subscribe.
 * @returns Le message d'erreur précis du backend, ou un fallback contextualisé.
 */
export function extractApiError(err: any): string {
  const body = err?.error;
  const explicitMsg =
    (typeof body === 'object' && body !== null ? (body.erreur || body.message || body.detail) : null) ||
    (typeof body === 'string' && body.trim().length > 0 && !body.trim().startsWith('<') ? body.trim() : null);

  // Si des erreurs par champ sont présentes, les résumer clairement
  if (body && typeof body === 'object') {
    const rawDetails = body.details || body.fieldErrors || body.errors;
    if (Array.isArray(rawDetails) && rawDetails.length > 0) {
      const first = rawDetails[0];
      const fieldMsg = first?.message || first?.defaultMessage || first?.erreur;
      const fieldName = first?.champ || first?.field;
      if (fieldMsg) {
        return fieldName ? `${fieldName} : ${fieldMsg}` : String(fieldMsg);
      }
    }
  }

  // 423 LOCKED, compte bloqué
  if (err?.status === 423) {
    return explicitMsg || 'Votre compte est temporairement bloqué. Contactez un administrateur NTFOODS.';
  }

  // 401 UNAUTHORIZED
  if (err?.status === 401) {
    return explicitMsg || 'Identifiants incorrects ou session expirée. Veuillez vous reconnecter.';
  }

  // 403 FORBIDDEN
  if (err?.status === 403) {
    return explicitMsg || 'Accès refusé : vos permissions actuelles ne permettent pas cette opération.';
  }

  // 404 NOT FOUND
  if (err?.status === 404) {
    return explicitMsg || 'La ressource demandée est introuvable ou a été archivée.';
  }

  // 409 CONFLICT
  if (err?.status === 409) {
    return explicitMsg || 'Conflit métier : cette opération entre en contradiction avec l\'état actuel des données.';
  }

  // 422 UNPROCESSABLE ENTITY / 400 BAD REQUEST
  if (err?.status === 400 || err?.status === 422) {
    return explicitMsg || 'Données invalides ou incomplètes. Vérifiez les champs saisis.';
  }

  // 502 / 503 / 504 GATEWAY / SERVICE UNAVAILABLE
  if (err?.status === 502 || err?.status === 503 || err?.status === 504) {
    return 'Le serveur NTFOODS est en cours de réveil ou temporairement indisponible. Réessayez dans quelques secondes.';
  }

  // 500 INTERNAL SERVER ERROR
  if (err?.status === 500) {
    return explicitMsg || 'Erreur interne du serveur. L\'incident a été journalisé, veuillez réessayer.';
  }

  // Network error (no status)
  if (err?.status === 0 || err?.status === -1) {
    return 'Serveur injoignable. Vérifiez votre connexion réseau ou patientez pendant le réveil du serveur.';
  }

  // Generic fallback
  return explicitMsg || err?.message || 'Une erreur inattendue est survenue. Veuillez réessayer.';
}
