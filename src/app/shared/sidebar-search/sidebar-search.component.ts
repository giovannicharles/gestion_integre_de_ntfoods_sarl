import { Component, ChangeDetectionStrategy, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Champ de recherche du sidebar (2026-10-25, demande explicite du porteur) — filtre inline léger :
 * ce composant ne porte AUCUNE logique de filtrage lui-même (les formes de NavItem/NavGroup diffèrent
 * entre layouts) ; il émet seulement la saisie, chaque layout filtre ses propres items via
 * `shared/utils/nav-filter.util.ts`.
 */
@Component({
  selector: 'app-sidebar-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sbs-wrap">
      <i class="fa-solid fa-magnifying-glass sbs-ico"></i>
      <input
        type="text"
        class="sbs-input"
        placeholder="Rechercher un module..."
        [ngModel]="query()"
        (ngModelChange)="onQuery($event)"
        aria-label="Rechercher un module dans le menu" />
      @if (query()) {
        <button type="button" class="sbs-clear" (click)="onQuery('')" title="Effacer">
          <i class="fa-solid fa-xmark"></i>
        </button>
      }
    </div>
  `,
  styles: [`
    .sbs-wrap {
      display: flex; align-items: center; gap: 8px;
      margin: 0 8px 8px; padding: 7px 10px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: var(--r-md, 8px);
      transition: background .15s, border-color .15s;
    }
    .sbs-wrap:focus-within { background: rgba(255,255,255,0.14); border-color: var(--y); }
    .sbs-ico { color: rgba(255,255,255,0.5); font-size: 12px; flex-shrink: 0; }
    .sbs-input {
      flex: 1; border: none; background: none; outline: none;
      color: #fff; font-size: 12.5px; font-family: var(--font-b); min-width: 0;
    }
    .sbs-input::placeholder { color: rgba(255,255,255,0.45); }
    .sbs-clear { border: none; background: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 11px; flex-shrink: 0; padding: 0; }
    .sbs-clear:hover { color: #fff; }
  `],
})
export class SidebarSearchComponent {
  @Output() queryChange = new EventEmitter<string>();
  query = signal('');

  onQuery(value: string): void {
    this.query.set(value);
    this.queryChange.emit(value);
  }
}
