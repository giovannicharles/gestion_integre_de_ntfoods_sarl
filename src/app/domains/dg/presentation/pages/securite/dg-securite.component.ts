import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DgService, ParametreSystemeBE } from '../../../infrastructure/dg.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { CanDirective } from '../../../../../shared/directives/can.directive';
import { AuthService } from '../../../../../core/auth/auth.service';

/**
 * Paramètres système — seuils de sécurité & session (2026-10-25) : GET/PUT /api/dg/parametres
 * existaient déjà côté serveur (GererParametresSystemeUseCase), aucun écran ne les exposait —
 * seul moyen de changer `SEUIL_SECURITE_CAISSE`, `MAX_TENTATIVES_CONNEXION`,
 * `DUREE_SESSION_HEURES`, etc. était une modification directe en base. Distinct de
 * `/dg/parametres-metier` (TVA/primes, autre table) et de `/dg/seuils` (seuils de
 * réapprovisionnement par produit).
 */
@Component({
  selector: 'app-dg-securite',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, CanDirective],
  templateUrl: './dg-securite.component.html',
  styleUrls: ['./dg-securite.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DgSecuriteComponent implements OnInit {
  private readonly dgSvc = inject(DgService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  /** PUT /api/dg/parametres est gardé `hasRole('DIRECTEUR_GENERAL')` exclusivement (DgController.java:265)
   * — plus strict que le GET (ADMIN compris) : l'ADMIN voit les valeurs, ne peut pas les modifier. */
  peutModifier = computed(() => this.auth.hasAnyRole(['DIRECTEUR_GENERAL']));

  loading = signal(true);
  loadError = signal<string | null>(null);
  parametres = signal<ParametreSystemeBE[]>([]);
  saving = signal(false);

  /** Valeurs en cours d'édition, par clé — seules celles qui diffèrent de la valeur serveur sont envoyées. */
  valeursEditees = signal<Record<string, number>>({});

  aDesModifications = computed(() => Object.keys(this.valeursEditees()).length > 0);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.dgSvc.getParametresSysteme().subscribe({
      next: p => { this.parametres.set(p); this.valeursEditees.set({}); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  valeurAffichee(p: ParametreSystemeBE): number {
    return this.valeursEditees()[p.cle] ?? p.valeurNumerique;
  }

  surSaisie(p: ParametreSystemeBE, valeur: number): void {
    this.valeursEditees.update(v => {
      const next = { ...v };
      if (valeur === p.valeurNumerique) {
        delete next[p.cle];
      } else {
        next[p.cle] = valeur;
      }
      return next;
    });
  }

  annulerModifications(): void {
    this.valeursEditees.set({});
  }

  enregistrer(): void {
    const modifications = this.valeursEditees();
    if (Object.keys(modifications).length === 0 || this.saving()) return;
    this.saving.set(true);
    this.dgSvc.modifierParametresSysteme(modifications).subscribe({
      next: p => {
        this.saving.set(false);
        this.parametres.set(p);
        this.valeursEditees.set({});
        this.toast.success('Paramètres système mis à jour.');
      },
      error: e => { this.saving.set(false); this.toast.error(extractApiError(e), 'Enregistrement impossible'); },
    });
  }
}
