import { Component, ChangeDetectionStrategy, Input, ElementRef, ViewChild, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NavItemLike, correspond } from '../utils/nav-filter.util';

export interface CommandPaletteItem extends NavItemLike {
  groupe?: string;
}

/**
 * Palette de commandes Ctrl+K (2026-11-01, bloc 12 DG_MODULE_SPEC.md : "Palette de commandes
 * Ctrl+K + recherche globale" était confirmé totalement absent, `SidebarSearchComponent`/
 * `HeaderSearchComponent` ne filtrent que la navigation en place, sans raccourci clavier global ni
 * recherche depuis n'importe quel écran). Motif Linear/Raycast/Vercel : overlay plein écran,
 * ouverture au clavier de partout, navigation flèches + Entrée, fermeture Échap.
 *
 * Portée honnête de cette première version : recherche sur les éléments de navigation du module
 * (déjà ~20 écrans pour le DG), pas encore un index transversal des entités métier (produits,
 * lots, commandes, utilisateurs, demandes), construire cet index transversal est un chantier
 * backend séparé (un nouvel agrégateur de recherche), pas fait ce tour, signalé dans
 * DG_MODULE_SPEC.md plutôt que simulé avec des résultats inventés.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ouverte()) {
    <div class="cp-overlay" (click)="fermer()">
      <div class="cp-panel" (click)="$event.stopPropagation()">
        <div class="cp-input-row">
          <i class="fa-solid fa-magnifying-glass cp-ico"></i>
          <input
            #entree
            type="text"
            class="cp-input"
            placeholder="Rechercher un écran, une action..."
            [ngModel]="requete()"
            (ngModelChange)="onRequete($event)"
            (keydown)="onKeydown($event)"
            aria-label="Palette de commandes" />
          <kbd class="cp-kbd">Esc</kbd>
        </div>

        @if (resultats().length > 0) {
        <div class="cp-list" role="listbox">
          @for (r of resultats(); track r.route; let i = $index) {
          <button
            type="button"
            class="cp-item"
            [class.cp-item-active]="i === indexActif()"
            (mouseenter)="indexActif.set(i)"
            (click)="aller(r.route)">
            <i class="fa-solid {{ r.icon || 'fa-circle' }} cp-item-ico"></i>
            <span class="cp-item-label">{{ r.label }}</span>
            @if (r.groupe) { <span class="cp-item-groupe">{{ r.groupe }}</span> }
          </button>
          }
        </div>
        } @else {
        <div class="cp-empty">
          <i class="fa-solid fa-ghost"></i>
          <span>Aucun résultat pour « {{ requete() }} ».</span>
        </div>
        }

        <div class="cp-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> ouvrir</span>
          <span><kbd>Échap</kbd> fermer</span>
        </div>
      </div>
    </div>
    }
  `,
  styles: [`
    .cp-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(15,23,20,.5); backdrop-filter: blur(2px);
      display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; animation: cpFadeIn .12s ease-out; }
    @keyframes cpFadeIn { from { opacity: 0; } to { opacity: 1; } }
    .cp-panel { width: min(560px, 92vw); background: var(--w, #fff); border-radius: var(--r-lg, 14px);
      box-shadow: 0 20px 60px rgba(0,0,0,.35); overflow: hidden; animation: cpSlideIn .14s ease-out; }
    @keyframes cpSlideIn { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .cp-input-row { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--n200, #e5e7eb); }
    .cp-ico { color: var(--text-muted, #9ca3af); font-size: 14px; }
    .cp-input { flex: 1; border: none; outline: none; background: none; font-size: 15px; color: var(--n900); }
    .cp-kbd { font-size: 11px; color: var(--n500); border: 1px solid var(--n200); border-radius: 5px; padding: 2px 6px; font-family: inherit; }
    .cp-list { max-height: 360px; overflow-y: auto; padding: 6px; }
    .cp-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none; background: none;
      border-radius: var(--r-md, 8px); cursor: pointer; text-align: left; font-size: 13.5px; color: var(--n800); }
    .cp-item-active, .cp-item:hover { background: var(--g-gh); }
    .cp-item-ico { color: var(--g); width: 16px; font-size: 13px; flex-shrink: 0; }
    .cp-item-label { flex: 1; }
    .cp-item-groupe { font-size: 11px; color: var(--n500); background: var(--n100); border-radius: 99px; padding: 2px 8px; }
    .cp-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 16px; color: var(--text-muted, #9ca3af); font-size: 13px; }
    .cp-empty i { font-size: 22px; }
    .cp-footer { display: flex; gap: 16px; padding: 10px 16px; border-top: 1px solid var(--n200, #e5e7eb); font-size: 11.5px; color: var(--n500); }
    .cp-footer kbd { font-family: inherit; }
  `],
})
export class CommandPaletteComponent {
  @Input() items: CommandPaletteItem[] = [];
  @ViewChild('entree') entreeRef?: ElementRef<HTMLInputElement>;

  ouverte = signal(false);
  requete = signal('');
  indexActif = signal(0);

  resultats = computed(() => {
    const q = this.requete();
    const items = q.trim() ? this.items.filter(i => correspond(i.label, q)) : this.items;
    return items.slice(0, 8);
  });

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.ouverte() ? this.fermer() : this.ouvrir();
    } else if (e.key === 'Escape' && this.ouverte()) {
      this.fermer();
    }
  }

  /** Public : permet un bouton visible dans le header en plus du raccourci clavier (découvrabilité). */
  ouvrir() {
    this.ouverte.set(true);
    this.requete.set('');
    this.indexActif.set(0);
    setTimeout(() => this.entreeRef?.nativeElement.focus(), 0);
  }

  fermer() {
    this.ouverte.set(false);
  }

  onRequete(v: string) {
    this.requete.set(v);
    this.indexActif.set(0);
  }

  onKeydown(e: KeyboardEvent) {
    const n = this.resultats().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.indexActif.set(n === 0 ? 0 : (this.indexActif() + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.indexActif.set(n === 0 ? 0 : (this.indexActif() - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = this.resultats()[this.indexActif()];
      if (r) this.aller(r.route);
    }
  }

  constructor(private readonly router: Router) {}

  aller(route: string) {
    this.router.navigate([route]);
    this.fermer();
  }
}
