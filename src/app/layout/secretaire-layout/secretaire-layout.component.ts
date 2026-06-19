import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-secretaire-layout',
  standalone: true,
  imports: [],
  templateUrl: './secretaire-layout.component.html',
  styleUrl: './secretaire-layout.component.css'
})
export class SecretaireLayoutComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
