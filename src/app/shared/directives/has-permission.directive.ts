import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

/**
 * `*appHasPermission="'STOCK_X_GERER'"` ou `*appHasPermission="['A','B']"` —
 * masque le contenu si l'utilisateur courant n'a aucune des permissions
 * listées.
 *
 * À utiliser à la place de `*appCan` (rôles) sur les modules dont le backend
 * garde ses endpoints par permission (`hasAuthority(...)`) et non par rôle
 * (`hasRole`/`hasAnyRole`) — Stock, Commercial et Production, vérifié le
 * 2026-10-28 : un `*appCan` à rôles devinés y affichait des boutons à des
 * utilisateurs qui recevaient un 403 au clic, et pouvait en masquer à
 * d'autres qui avaient réellement le droit (dérogation individuelle qu'un
 * rôle seul ne reflète jamais). Confort d'affichage uniquement (§6.7
 * CLAUDE.md) : le serveur reste la seule source de vérité ; le code passé
 * doit toujours correspondre au `@PreAuthorize("hasAuthority(...)")` réel de
 * l'endpoint visé, jamais une permission inventée.
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  private hasView = false;
  private readonly codes = signal<readonly string[]>([]);

  constructor() {
    effect(() => {
      const allowed = this.authService.hasAnyPermission(this.codes());
      if (allowed && !this.hasView) {
        this.viewContainerRef.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainerRef.clear();
        this.hasView = false;
      }
    });
  }

  @Input() set appHasPermission(codes: string | readonly string[]) {
    this.codes.set(typeof codes === 'string' ? [codes] : (codes ?? []));
  }
}
