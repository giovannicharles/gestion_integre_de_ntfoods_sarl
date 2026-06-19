import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authInterceptor = (request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);

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
    catchError((error: HttpErrorResponse) => {
      // Gérer les erreurs d'authentification (401, 403)
      if (error.status === 401 || error.status === 403) {
        // Token expiré ou invalide, déconnecter l'utilisateur
        authService.logout();
        router.navigate(['/auth/login']);
      }
      
      // Retourner l'erreur pour que le composant puisse la gérer
      return throwError(() => error);
    })
  );
};
