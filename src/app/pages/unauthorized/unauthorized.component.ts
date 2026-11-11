import { Component, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_HOMES, ROLE_LABELS, UserRole } from '../../core/models/user.models';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './unauthorized.component.html',
  styleUrl: './unauthorized.component.css'
})
export class UnauthorizedComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly auth = inject(AuthService);

  readonly serverMessage = signal<string | null>(null);

  constructor() {
    const navState = this.router.getCurrentNavigation()?.extras?.state ?? history.state;
    if (navState && typeof navState['message'] === 'string' && navState['message'].trim()) {
      this.serverMessage.set(navState['message'].trim());
    }
  }

  get roleLabel(): string {
    const r = this.auth.role() as UserRole | null;
    return r ? (ROLE_LABELS[r] ?? r) : 'Utilisateur';
  }

  goHome(): void {
    const r = this.auth.role() as UserRole | null;
    const target = (r && ROLE_HOMES[r]) ? ROLE_HOMES[r] : '/auth/login';
    this.router.navigateByUrl(target);
  }

  goBack(): void {
    this.location.back();
  }
}
