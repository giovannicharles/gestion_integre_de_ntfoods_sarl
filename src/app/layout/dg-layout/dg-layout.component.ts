import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dg-layout',
  standalone: true,
  imports: [],
  templateUrl: './dg-layout.component.html',
  styleUrl: './dg-layout.component.css'
})
export class DgLayoutComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
