import { Component, ChangeDetectionStrategy, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NavItemLike, filtrerNavItems } from '../utils/nav-filter.util';

/**
 * Recherche du header (2026-10-25, demande explicite du porteur — « une barre aussi dans le
 * header ») : contrairement au sidebar, il n'y a pas de longue liste à filtrer en place dans la
 * topbar — un petit menu de résultats cliquables sert d'équivalent. Réutilise le même utilitaire
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
    .hs-wrap { position: relative; display: flex; align-items: center; gap: 8px;
      width: 220px; padding: 7px 12px; border-radius: var(--r-md, 8px);
      background: var(--n50, #f3f4f6); border: 1px solid var(--border, #e5e7eb);
      transition: border-color .15s, box-shadow .15s; }
    .hs-wrap:focus-within { border-color: var(--g); box-shadow: 0 0 0 3px rgba(20,83,45,.1); }
    .hs-ico { color: var(--text-muted, #9ca3af); font-size: 12px; flex-shrink: 0; }
    .hs-input { flex: 1; border: none; background: none; outline: none; font-size: 13px; color: var(--n900); min-width: 0; }
    .hs-dropdown {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0;
      background: var(--w, #fff); border: 1px solid var(--border, #e5e7eb);
      border-radius: var(--r-md, 8px); box-shadow: var(--sh-md);
      z-index: 50; overflow: hidden; max-height: 280px; overflow-y: auto;
    }
    .hs-result {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 9px 12px; border: none; background: none; cursor: pointer;
      font-size: 13px; color: var(--n800); text-align: left;
    }
    .hs-result:hover { background: var(--g-gh); }
    .hs-result i { color: var(--g); width: 16px; font-size: 12px; }
    .hs-empty { padding: 14px; font-size: 12.5px; color: var(--text-muted, #9ca3af); text-align: center; }
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
