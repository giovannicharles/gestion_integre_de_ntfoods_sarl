import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';

/**
 * Bannière de mise à jour (2026-10-25, demande explicite du porteur — notification de nouvelle
 * version + bouton pour mettre à jour). S'appuie sur `SwUpdate.versionUpdates`, natif à
 * `@angular/service-worker` : aucun endpoint backend de version à construire. Désactivé en
 * développement (le service worker lui-même l'est, voir `app.config.ts` — `enabled: !isDevMode()`).
 */
@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (nouvelleVersion()) {
      <div class="ub-banner" role="status">
        <i class="fa-solid fa-rotate ub-ico"></i>
        <span class="ub-texte">Une nouvelle version de TANTY Digital est disponible.</span>
        <button type="button" class="ub-btn" (click)="mettreAJour()">
          <i class="fa-solid fa-arrow-up"></i> Mettre à jour
        </button>
        <button type="button" class="ub-close" (click)="nouvelleVersion.set(false)" title="Plus tard">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    }
  `,
  styles: [`
    .ub-banner {
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      z-index: 2000; display: flex; align-items: center; gap: 12px;
      background: var(--g, #14532D); color: #fff;
      padding: 12px 16px; border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,.25);
      max-width: calc(100vw - 32px);
      animation: ub-slide-in .3s ease;
    }
    @keyframes ub-slide-in { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }
    .ub-ico { color: var(--y, #F6B60B); }
    .ub-texte { font-size: 13px; font-weight: 600; }
    .ub-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--y, #F6B60B); color: var(--g, #14532D);
      border: none; border-radius: 8px; padding: 7px 12px;
      font-size: 12.5px; font-weight: 700; cursor: pointer; flex-shrink: 0;
    }
    .ub-btn:hover { filter: brightness(1.05); }
    .ub-close { background: none; border: none; color: rgba(255,255,255,.7); cursor: pointer; flex-shrink: 0; }
    .ub-close:hover { color: #fff; }
    @media (max-width: 480px) { .ub-banner { flex-wrap: wrap; } }
  `],
})
export class UpdateBannerComponent implements OnInit {
  private readonly swUpdate = inject(SwUpdate);
  nouvelleVersion = signal(false);

  ngOnInit(): void {
    if (!this.swUpdate.isEnabled) return;
    this.swUpdate.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY') {
        this.nouvelleVersion.set(true);
      }
    });
  }

  mettreAJour(): void {
    this.swUpdate.activateUpdate().finally(() => window.location.reload());
  }
}
