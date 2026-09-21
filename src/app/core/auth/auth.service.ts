import { Injectable, computed, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../http/api.service';
import { ApiResponse } from '../models/api-response.model';
import { LoginRequest, LoginResponse, User } from '../models/auth.models';
import { UserRole, mapBackendRole } from '../models/user.models';

const TOKEN_KEY = 'tanty_token';
const EXPIRATION_KEY = 'tanty_token_expiration';
const USER_KEY = 'tanty_user';

/**
 * Utilisateur connecté tel que conservé côté client.
 *
 * Le type reprend `User` sans rien y ajouter ; l'alias est conservé parce que
 * les écrans du socle l'importent sous ce nom.
 */
export type SessionUser = User;

/**
 * Service d'authentification — branché sur le backend Spring Boot.
 *
 * ── Double facteur ─────────────────────────────────────────────────────────
 * `requestOtp` et `verifyOtp` restent disponibles et alignés sur les routes
 * serveur, mais **aucun parcours ne les emprunte pour l'instant** : la
 * connexion est directe. C'est une décision de configuration, pas une
 * suppression — rebrancher l'écran `two-fa` suffit à rétablir le second
 * facteur, sans réécrire quoi que ce soit.
 *
 * ── Clés de stockage ───────────────────────────────────────────────────────
 * `tanty_token` / `tanty_token_expiration` / `tanty_user`. La date
 * d'expiration est conservée séparément parce que l'intercepteur la lit avant
 * chaque requête pour couper la session à l'échéance plutôt que d'attendre un
 * 401 du serveur.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  /** Utilisateur courant (réactif). Null si déconnecté. */
  private readonly _user = signal<SessionUser | null>(this.readStoredUser());
  readonly user = this._user.asReadonly();

  /** Même état, exposé en flux pour les écrans qui s'y abonnent. */
  private readonly _user$ = new BehaviorSubject<SessionUser | null>(this._user());
  readonly currentUser$ = this._user$.asObservable();

  readonly isAuthenticated = computed(() => this._user() !== null && this.getToken() !== null);
  readonly role = computed(() => this._user()?.role ?? null);

  /** POST /api/auth/login → stocke token + utilisateur, renvoie la réponse. */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    const payload = {
      matricule: credentials.matricule,
      password: credentials.password || credentials.motDePasse
    };
    return this.api.post<ApiResponse<LoginResponse>>('auth/login', payload).pipe(
      map((res) => {
        const data = res.donnees;
        if (!res.succes || !data) {
          throw new Error(res.erreur || res.message || 'Échec de la connexion');
        }
        this.persistSession(data);
        return data;
      })
    );
  }

  /**
   * POST /api/auth/otp/demander → demande un code OTP.
   * Conservé et fonctionnel ; aucun parcours ne l'appelle actuellement.
   */
  requestOtp(matricule: string, raison: string = 'AUTHENTIFICATION'): Observable<{ otpId: string }> {
    return this.api.post<ApiResponse<{ otpId: string }>>('auth/otp/demander', { matricule, raison }).pipe(
      map((res) => {
        if (!res.succes || !res.donnees) {
          throw new Error(res.erreur || res.message || 'Échec de l\'envoi de l\'OTP');
        }
        return res.donnees;
      })
    );
  }

  /** POST /api/auth/otp/verifier → vérifie le code OTP et ouvre une session JWT. */
  verifyOtp(matricule: string, otpCode: string): Observable<LoginResponse> {
    return this.api.post<ApiResponse<LoginResponse>>('auth/otp/verifier', { matricule, codeOtp: otpCode }).pipe(
      map((res) => {
        const data = res.donnees;
        if (!res.succes || !data) {
          throw new Error(res.erreur || res.message || 'Code OTP invalide');
        }
        this.persistSession(data);
        return data;
      })
    );
  }

  logout(): void {
    this.api.post<ApiResponse<void>>('auth/logout', {}).subscribe({
      error: () => { /* session locale nettoyée même si le serveur est injoignable */ },
    });
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRATION_KEY);
    localStorage.removeItem(USER_KEY);
    this.setUser(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** Vrai si une session locale existe. Ne vérifie pas sa validité serveur. */
  isLoggedIn(): boolean {
    return this.getToken() !== null && this._user() !== null;
  }

  /** Utilisateur courant, en lecture directe. */
  getCurrentUser(): SessionUser | null {
    return this._user();
  }

  hasRole(role: string): boolean {
    return this.role() === role;
  }

  /**
   * Accepte aussi bien `UserRole[]` que `string[]` : les écrans du socle
   * passent le type strict, ceux du module production des chaînes brutes.
   */
  hasAnyRole(roles: readonly (UserRole | string)[]): boolean {
    const r = this.role();
    return r !== null && roles.includes(r);
  }

  private persistSession(data: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(EXPIRATION_KEY, (Date.now() + data.expirationMs).toString());
    localStorage.setItem(USER_KEY, JSON.stringify(this.toSessionUser(data)));
    this.setUser(this.toSessionUser(data));
  }

  /**
   * Construit l'utilisateur de session à partir de la réponse serveur.
   *
   * Un rôle que le client ne connaît pas est conservé tel quel plutôt que
   * remplacé : la connexion aboutit, mais aucune route ne le liste, donc les
   * gardes refusent. L'échec est fermé, et l'anomalie visible en console au
   * lieu d'être masquée par un rôle de repli.
   */
  private toSessionUser(data: LoginResponse): SessionUser {
    const connu = mapBackendRole(data.role);
    if (connu === null) {
      console.error(
        `[AuthService] Rôle « ${data.role} » inconnu du client. Aucun accès ne lui est accordé ; ` +
        `ajouter la valeur à BACKEND_ROLE_MAP si le backend l'a introduite.`
      );
    }
    const role = (connu ?? data.role) as UserRole;
    const parts = (data.nomComplet ?? '').split(' ').filter((p) => p.length > 0);
    return {
      token: data.token,
      matricule: data.matricule,
      nomComplet: data.nomComplet ?? '',
      firstname: parts[0] ?? '',
      lastname: parts.slice(1).join(' '),
      role,
      roles: connu === null ? [] : [connu],
    };
  }

  private setUser(user: SessionUser | null): void {
    this._user.set(user);
    this._user$.next(user);
  }

  private readStoredUser(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }
}
