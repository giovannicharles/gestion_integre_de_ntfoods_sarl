import { Component, ChangeDetectionStrategy, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NavItemLike, filtrerNavItems } from '../utils/nav-filter.util';

/**
 * Recherche du header (2026-10-25, demande explicite du porteur, « une barre aussi dans le
 * header ») : contrairement au sidebar, il n'y a pas de longue liste à filtrer en place dans la
 * topbar, un petit menu de résultats cliquables sert d'équivalent. Réutilise le même utilitaire
 * de filtrage que le sidebar (`nav-filter.util.ts`), pas un second système de recherche.
 */
@Component({
  selector: 'app-header-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hs-wrap" (click)="$event.stopPropagation()">
      <i class="fa-solid fa-magnifying-glass hs-ico"></i>
      <input
        type="text"
        class="hs-input"
        placeholder="Rechercher..."
        [ngModel]="query()"
        (ngModelChange)="onQuery($event)"
        (focus)="focused.set(true)"
        (blur)="onBlur()"
        aria-label="Rechercher un module" />

      @if (focused() && query() && resultats().length > 0) {
        <div class="hs-dropdown">
          @for (r of resultats(); track r.route) {
            <button type="button" class="hs-result" (click)="aller(r.route)">
              <i class="fa-solid {{ r.icon || 'fa-circle' }}"></i>
              <span>{{ r.label }}</span>
            </button>
          }
        </div>
      } @else if (focused() && query() && resultats().length === 0) {
        <div class="hs-dropdown">
          <div class="hs-empty">Aucun module trouvé.</div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-flex; }
    .hs-wrap {
      position: relative; display: flex; align-items: center; gap: 8px;
      width: 200px; height: 36px; padding: 0 12px; border-radius: 9px;
      background: var(--n50, #F3F8F5); border: 1px solid var(--n200, #D5E4DC);
      transition: all .18s ease;
    }
    .hs-wrap:focus-within {
      width: 240px;
      background: #FFFFFF;
      border-color: var(--g, #14532D);
      box-shadow: 0 0 0 3px rgba(20, 83, 45, 0.12);
    }
    :host-context(:root.dark-mode) .hs-wrap {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.12);
    }
    :host-context(:root.dark-mode) .hs-wrap:focus-within {
      background: #161E19;
      border-color: var(--y, #F6B60B);
    }
    .hs-ico { color: var(--g, #14532D); font-size: 12px; flex-shrink: 0; opacity: 0.75; }
    :host-context(:root.dark-mode) .hs-ico { color: var(--y, #F6B60B); }
    .hs-input {
      flex: 1; border: none; background: none; outline: none;
      font-size: 12.5px; font-weight: 500; color: var(--n900, #0F172A); min-width: 0;
    }
    :host-context(:root.dark-mode) .hs-input { color: #F3F8F5; }
    .hs-dropdown {
      position: absolute; top: calc(100% + 8px); left: 0; min-width: 260px; right: 0;
      background: var(--w, #FFFFFF); border: 1px solid var(--g-pale, #B7DFC6);
      border-radius: 12px; box-shadow: 0 12px 32px rgba(13, 58, 30, 0.16);
      z-index: 2100; overflow: hidden; max-height: 300px; overflow-y: auto;
    }
    :host-context(:root.dark-mode) .hs-dropdown {
      background: #161E19; border-color: rgba(255, 255, 255, 0.12);
    }
    .hs-result {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 10px 14px; border: none; border-bottom: 1px solid var(--n100, #EAF2ED);
      background: none; cursor: pointer;
      font-size: 12.5px; font-weight: 600; color: var(--n800, #1E293B); text-align: left;
      transition: background 0.12s;
    }
    .hs-result:last-child { border-bottom: none; }
    .hs-result:hover { background: var(--g-sf, #E6F4EC); color: var(--g-d, #0D3A1E); }
    :host-context(:root.dark-mode) .hs-result { color: #E2E8F0; border-bottom-color: rgba(255,255,255,0.06); }
    :host-context(:root.dark-mode) .hs-result:hover { background: rgba(246, 182, 11, 0.12); color: var(--y, #F6B60B); }
    .hs-result i {
      color: var(--g, #14532D); width: 24px; height: 24px; border-radius: 6px;
      background: rgba(20, 83, 45, 0.08);
      display: inline-flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;
    }
    .hs-empty { padding: 14px; font-size: 12.5px; color: var(--n500, #64748B); text-align: center; }
    @media (max-width: 1180px) {
      .hs-wrap { width: 145px; }
      .hs-wrap:focus-within { width: 190px; }
    }
    @media (max-width: 820px) {
      :host { display: none; }
    }
  `],
})
export class HeaderSearchComponent {
  @Input() items: NavItemLike[] = [];

  query = signal('');
  focused = signal(false);

  resultats = computed(() => filtrerNavItems(this.items, this.query()).slice(0, 6));

  constructor(private readonly router: Router) {}

  onQuery(value: string): void {
    this.query.set(value);
  }

  /** Délai court : laisse le clic sur un résultat s'exécuter avant de fermer le menu. */
  onBlur(): void {
    setTimeout(() => this.focused.set(false), 150);
  }

  aller(route: string): void {
    this.router.navigate([route]);
    this.query.set('');
    this.focused.set(false);
  }
}
