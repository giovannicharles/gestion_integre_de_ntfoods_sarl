import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/models/user.models';

/**
 * `*appCan="['ROLE_A','ROLE_B']"` — masque le contenu si l'utilisateur courant n'a aucun des
 * rôles listés. Confort d'affichage uniquement (§6.7 CLAUDE.md) : le serveur reste la seule
 * source de vérité, cette directive ne fait qu'éviter d'afficher un bouton que l'utilisateur ne
 * pourra pas utiliser. Les rôles passés doivent correspondre à ceux déjà déclarés sur la route
 * (app.routes.ts), jamais une nouvelle règle inventée côté frontend.
 */
@Directive({
  selector: '[appCan]',
  standalone: true
})
export class CanDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  private hasView = false;
  private readonly roles = signal<readonly (UserRole | string)[]>([]);

  constructor() {
    effect(() => {
      const allowed = this.authService.hasAnyRole(this.roles());
      if (allowed && !this.hasView) {
        this.viewContainerRef.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainerRef.clear();
        this.hasView = false;
      }
    });
  }

  @Input() set appCan(roles: readonly (UserRole | string)[]) {
    this.roles.set(roles ?? []);
  }
}
