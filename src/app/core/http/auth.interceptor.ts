import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NetworkService } from '../services/network.service';

const EXPIRATION_KEY = 'tanty_token_expiration';

/**
 * Intercepteur JWT.
 *
 * Il fait trois choses, dans cet ordre : il coupe la session dont le jeton a
 * expiré **avant** d'émettre la requête ; il pose l'en-tête `Authorization` ;
 * il traite les refus du serveur en distinguant les cas plutôt qu'en
 * déconnectant à la moindre erreur.
 *
 * ── Distinction 401 / 403 ──────────────────────────────────────────────────
 * Un 401 signifie que la session n'est plus valable : déconnexion. Un 403
 * signifie qu'elle est valable mais que l'acte est refusé : la session est
 * **conservée**, l'utilisateur est renvoyé vers la page de refus avec le motif
 * du serveur. Les confondre déconnecterait quelqu'un pour avoir cliqué sur un
 * bouton qui ne le concerne pas.
 *
 * ── Joignabilité ───────────────────────────────────────────────────────────
 * Chaque réponse renseigne `NetworkService`, dont les bandeaux d'indisponibilité
 * dépendent. Un statut 0 ou un 504 désigne un serveur injoignable, ce qui n'est
 * pas une erreur applicative et ne doit pas être présenté comme telle.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const network = inject(NetworkService);
  const token = auth.getToken();

  // Expiration vérifiée avant l'envoi : inutile de solliciter le serveur pour
  // apprendre ce que la date d'échéance dit déjà.
  if (token) {
    const expirationStr = localStorage.getItem(EXPIRATION_KEY);
    if (expirationStr) {
      const expirationMs = parseInt(expirationStr, 10);
      if (Date.now() >= expirationMs) {
        auth.logout();
        router.navigate(['/auth/login'], { queryParams: { reason: 'expired' } });
        return throwError(() => new Error('Session expirée. Veuillez vous reconnecter.'));
      }
    }
  }

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    tap(() => network.setApiReachable()),
    catchError((error) => {
      const backendMessage = error?.error?.erreur || error?.error?.message || null;

      if (error?.status === 0 || error?.status === -1 || error?.status === 504) {
        network.setApiUnreachable();
      }

      if (error?.status === 401) {
        auth.logout();
        router.navigate(['/auth/login'], { queryParams: { reason: 'unauthorized' } });
      } else if (error?.status === 403) {
        // Un 403 sur une écriture est un acte refusé : on l'annonce en toutes
        // lettres sur la page de refus.
        //
        // Un 403 sur une lecture, en revanche, vient presque toujours d'un
        // chargement de fond — une carte du tableau de bord, un compteur, une
        // liste secondaire. Y répondre par une navigation éjectait l'utilisateur
        // d'un écran auquel il avait pleinement droit, à cause d'un widget qui
        // ne le concernait pas. L'erreur est donc rendue à l'appelant, qui
        // décide quoi montrer à sa place.
        if (request.method !== 'GET') {
          router.navigate(['/auth/forbidden'], {
            state: { message: backendMessage },
          });
        }
      } else if (error?.status === 423) {
        // 423 LOCKED : compte bloqué. Déconnexion, avec un motif explicite.
        auth.logout();
        router.navigate(['/auth/login'], { queryParams: { reason: 'locked' } });
      }
      return throwError(() => error);
    })
  );
};
