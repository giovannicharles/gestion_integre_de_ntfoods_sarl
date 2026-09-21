import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, CodeObservationBE } from '../../../infrastructure/admin.service';

@Component({
  selector: 'app-codes-observation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './codes-observation.component.html',
  styleUrls: ['./codes-observation.component.css'],
})
export class CodesObservationComponent implements OnInit {
  private readonly svc = inject(AdminService);

  codes = signal<CodeObservationBE[]>([]);
  loading = signal(false);
  message = signal<{ texte: string; type: 'succes' | 'erreur' } | null>(null);

  nouveau = {
    code: '',
    libelle: '',
    requireQuantity: false,
    actif: true,
    ordre: 0,
  };

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getCodesObservation().subscribe({
      next: (liste) => { this.codes.set(liste); this.loading.set(false); },
      error: (e) => { this.afficherErreur(e); this.loading.set(false); },
    });
  }

  ajouter(): void {
    const code = this.nouveau.code.trim().toUpperCase();
    const libelle = this.nouveau.libelle.trim();
    if (!code || !libelle) return;
    this.loading.set(true);
    this.svc.creerCodeObservation(code, libelle, this.nouveau.requireQuantity, this.nouveau.ordre)
      .subscribe({
        next: () => {
          this.nouveau = { code: '', libelle: '', requireQuantity: false, actif: true, ordre: 0 };
          this.afficher('Code ajouté', 'succes');
          this.charger();
        },
        error: (e) => { this.afficherErreur(e); this.loading.set(false); },
      });
  }

  basculerActif(c: CodeObservationBE): void {
    this.svc.modifierCodeObservation(c.id, c.code, c.libelle, c.requireQuantity, !c.actif, c.ordre)
      .subscribe({ next: () => this.charger(), error: (e) => this.afficherErreur(e) });
  }

  supprimer(id: number): void {
    if (!confirm('Supprimer ce code ?')) return;
    this.svc.supprimerCodeObservation(id).subscribe({
      next: () => { this.afficher('Code supprimé', 'succes'); this.charger(); },
      error: (e) => this.afficherErreur(e),
    });
  }

  private afficher(texte: string, type: 'succes' | 'erreur'): void {
    this.message.set({ texte, type });
    setTimeout(() => this.message.set(null), 3000);
  }

  private afficherErreur(e: unknown): void {
    const err = e as { error?: { message?: string; erreur?: string } };
    this.afficher(err?.error?.erreur ?? err?.error?.message ?? 'Erreur serveur', 'erreur');
  }
}
