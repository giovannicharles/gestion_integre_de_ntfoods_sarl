import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PreloaderComponent } from './shared/preloader/preloader.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { UpdateBannerComponent } from './shared/update-banner/update-banner.component';
import { NetworkService } from './core/services/network.service';
import { AuthService } from './core/auth/auth.service';
import { ChatbotComponent, ChatbotContext } from './shared/chatbot/chatbot.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, PreloaderComponent, ToastContainerComponent, UpdateBannerComponent, ChatbotComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'tanty_digital_pwa';
  /**
   * Hors ligne / nouvelle version (2026-10-25, demande explicite du porteur) : affichée ici,
   * à la racine, pour apparaître quel que soit le layout actif, auparavant seul stock-layout
   * la montrait. Réutilise NetworkService (core/services/network.service.ts), déjà global et
   * déjà alimenté par l'intercepteur HTTP + les évènements online/offline du navigateur.
   */
  readonly network = inject(NetworkService);
  readonly auth = inject(AuthService);

  /**
   * Assistant IA (2026-11-08, demande explicite : « même le côté chatbot » doit être complet
   * pour tous les modules). ChatbotComponent existait déjà, fonctionnel, mais n'était monté
   * nulle part : chaque layout aurait dû le reprendre séparément (9 fichiers) pour la même
   * capacité. Monté une seule fois ici, comme le reste de la coquille applicative (bannières
   * hors ligne/mise à jour ci-dessus), le module affiché se déduit du premier segment de l'URL.
   */
  chatbotContext = signal<ChatbotContext>({ module: 'DG' });

  constructor() {
    const router = inject(Router);
    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e) => {
      const segment = (e as NavigationEnd).urlAfterRedirects.split('/').filter(Boolean)[0] ?? '';
      this.chatbotContext.set({ module: segment.toUpperCase() || 'DG' });
    });
  }
}
