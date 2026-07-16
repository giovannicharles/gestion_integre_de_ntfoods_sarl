import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environment/environment';
import { LoginRequest, AuthResponse, User } from '../models/auth.models';
import { mapBackendRole } from '../models/user.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.authUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  /** Signal réactif exposé par les composants Windsurf. */
  private currentUserSignal = signal<User | null>(null);
  user = this.currentUserSignal.asReadonly();

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser) as User;
      this.currentUserSubject.next(user);
      this.currentUserSignal.set(user);
    }
  }

  login(loginRequest: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, loginRequest).pipe(
      tap(response => {
        const rawRoles = response.roles ?? (response.role ? [response.role] : []);
        const roles = rawRoles.map(mapBackendRole);
        const parts = (response.nomComplet ?? '').split(' ').filter(p => p.length > 0);
        const user: User = {
          token: response.token,
          matricule: response.matricule,
          firstname: response.firstname ?? parts[0] ?? '',
          lastname: response.lastname ?? parts.slice(1).join(' ') ?? '',
          roles
        };
        localStorage.setItem('token', response.token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
        this.currentUserSignal.set(user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.currentUserSignal.set(null);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.roles.includes(role) : false;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.getCurrentUser();
    return user ? user.roles.some((r: string) => roles.includes(r)) : false;
  }
}
