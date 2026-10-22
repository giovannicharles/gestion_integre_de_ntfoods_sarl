import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Rendu global du ToastService (shared/.../toast.service.ts) : le service existait déjà
 * (signal `toasts`, utilisé par ~20 composants via success()/error()/warning()/info()) mais
 * aucun composant ne le lisait nulle part — chaque appel était silencieusement sans effet
 * visuel (trouvé le 2026-10-21 en auditant incidents.component.ts : il appelle this.toast
 * .success(...)/.error(...) mais son template n'a aucun markup de toast). Monté une seule
 * fois à la racine (app.component.html) pour que les ~20 appelants existants fonctionnent
 * enfin, sans toucher à aucun d'eux.
 *
 * CSS local (pas styles.css global) : plusieurs écrans ont déjà leur propre `.toast`/
 * `.toast-success`/`.toast-error` en style global, à une seule position fixe — les
 * réutiliser pour un conteneur empilable aurait risqué de les casser. Classes distinctes ici.
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tc-stack">
      @for (t of toastService.toasts(); track t.id) {
        <div class="tc-toast" [class]="'tc-' + t.type">
          <i class="fa-solid tc-ico"
             [class.fa-circle-check]="t.type === 'success'"
             [class.fa-circle-xmark]="t.type === 'error'"
             [class.fa-triangle-exclamation]="t.type === 'warning'"
             [class.fa-circle-info]="t.type === 'info'"></i>
          <div class="tc-body">
            @if (t.title) { <div class="tc-title">{{ t.title }}</div> }
            <div class="tc-msg">{{ t.message }}</div>
          </div>
          @if (t.action) {
            <button class="tc-action" (click)="t.action!.handler(); toastService.remove(t.id)">{{ t.action.label }}</button>
          }
          <button class="tc-close" (click)="toastService.remove(t.id)" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
        </div>
      }
    </div>
  `,
  styles: [`
    .tc-stack { position: fixed; top: 20px; right: 20px; z-index: 3000; display: flex; flex-direction: column; gap: 10px; max-width: 380px; }
    .tc-toast { display: flex; align-items: flex-start; gap: 11px; padding: 14px 16px; border-radius: var(--r-md); font-size: 13px; font-weight: 600; box-shadow: var(--sh-lg); animation: tc-slide-in .25s ease; }
    .tc-ico { margin-top: 1px; flex-shrink: 0; }
    .tc-body { flex: 1; min-width: 0; }
    .tc-title { font-weight: 700; margin-bottom: 2px; }
    .tc-msg { font-weight: 500; line-height: 1.35; }
    .tc-close { background: none; border: none; cursor: pointer; opacity: .6; padding: 2px; flex-shrink: 0; color: inherit; }
    .tc-close:hover { opacity: 1; }
    .tc-action { background: rgba(255,255,255,.5); border: none; border-radius: var(--r-sm); padding: 4px 10px; font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0; color: inherit; }
    .tc-success { background: var(--s-gh); color: var(--s); border: 1.5px solid var(--s); }
    .tc-error { background: var(--r-gh); color: var(--r); border: 1.5px solid var(--r); }
    .tc-warning { background: var(--o-gh); color: var(--o); border: 1.5px solid var(--o); }
    .tc-info { background: var(--b-gh); color: var(--b); border: 1.5px solid var(--b); }
    @keyframes tc-slide-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
    @media (prefers-reduced-motion: reduce) { .tc-toast { animation: none; } }
    @media (max-width: 480px) { .tc-stack { left: 12px; right: 12px; top: 12px; max-width: none; } }
  `]
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
