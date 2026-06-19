import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-comptable-layout',
  standalone: true,
  imports: [],
  templateUrl: './comptable-layout.component.html',
  styleUrl: './comptable-layout.component.css'
})
export class ComptableLayoutComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
