import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, catchError, throwError, tap } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { NetworkService } from '../services/network.service';

export const authInterceptor = (request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const network = inject(NetworkService);

  // Récupérer le token depuis le service d'authentification
  const token = authService.getToken();

  // Si un token existe, l'ajouter à l'en-tête Authorization
  if (token) {
    request = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Passer la requête modifiée au prochain handler
  return next(request).pipe(
    tap(() => network.setApiReachable()),
    catchError((error: HttpErrorResponse) => {
      const isNetworkError = error.status === 0 || error.status === -1;
      const isTimeout = error.status === 504;

      if (isNetworkError || isTimeout) {
        network.setApiUnreachable();
      }

      // Gérer les erreurs d'authentification (401 uniquement)
      // 403 = accès refusé à une ressource, ne pas déconnecter
      if (error.status === 401) {
        // Token expiré ou invalide, déconnecter l'utilisateur
        authService.logout();
        router.navigate(['/auth/login']);
      }

      // Retourner l'erreur pour que le composant puisse la gérer
      return throwError(() => error);
    })
  );
};
