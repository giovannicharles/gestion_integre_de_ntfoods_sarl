import { Component, ChangeDetectionStrategy, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Champ de recherche du sidebar (2026-10-25, demande explicite du porteur), filtre inline léger :
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
    :host { display: block; }
    :host-context(.sidebar-collapsed) { display: none; }
    .sbs-wrap {
      display: flex; align-items: center; gap: 8px;
      margin: 2px 6px 10px; padding: 8px 11px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 9px;
      transition: background .15s, border-color .15s, box-shadow .15s;
    }
    .sbs-wrap:focus-within {
      background: rgba(255,255,255,0.16);
      border-color: var(--y, #F6B60B);
      box-shadow: 0 0 0 2px rgba(246, 182, 11, 0.22);
    }
    .sbs-ico { color: var(--y, #F6B60B); font-size: 12px; flex-shrink: 0; }
    .sbs-input {
      flex: 1; border: none; background: none; outline: none;
      color: #fff; font-size: 12.5px; font-weight: 500; font-family: var(--font-b); min-width: 0;
    }
    .sbs-input::placeholder { color: rgba(255,255,255,0.58); }
    .sbs-clear { border: none; background: none; color: rgba(255,255,255,0.65); cursor: pointer; font-size: 11px; flex-shrink: 0; padding: 0; }
    .sbs-clear:hover { color: var(--y, #F6B60B); }
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
