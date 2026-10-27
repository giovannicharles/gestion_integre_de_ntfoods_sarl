import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PreloaderComponent } from './shared/preloader/preloader.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { UpdateBannerComponent } from './shared/update-banner/update-banner.component';
import { NetworkService } from './core/services/network.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, PreloaderComponent, ToastContainerComponent, UpdateBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'tanty_digital_pwa';
  /**
   * Hors ligne / nouvelle version (2026-10-25, demande explicite du porteur) : affichée ici,
   * à la racine, pour apparaître quel que soit le layout actif — auparavant seul stock-layout
   * la montrait. Réutilise NetworkService (core/services/network.service.ts), déjà global et
   * déjà alimenté par l'intercepteur HTTP + les évènements online/offline du navigateur.
   */
  readonly network = inject(NetworkService);
}
