import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, CodePosteRef, CODES_POSTE } from '../../../../production/infrastructure/production.service';

@Component({
  selector: 'app-postes-production',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './postes-production.component.html',
  styleUrls: ['./postes-production.component.css'],
})
export class PostesProductionComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  postes = signal<CodePosteRef[]>(CODES_POSTE);
  loading = signal(false);
  message = signal<{ texte: string; type: 'succes' | 'erreur' } | null>(null);

  nouveau: CodePosteRef & { actif: boolean } = {
    code: '', libelle: '', effectifReference: 1,
    productionParHeure: 0, productionJournaliere: 0, unite: 'KG',
    categoriesMetier: [], actif: true,
  };

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getPostesProductionAdmin().subscribe({
      next: (liste) => { this.postes.set(liste); this.loading.set(false); },
      error: (e) => { this.afficherErreur(e); this.loading.set(false); },
    });
  }

  ajouter(): void {
    const p = this.nouveau;
    if (!p.code.trim() || !p.libelle.trim()) return;
    this.loading.set(true);
    this.svc.creerPosteProduction(p).subscribe({
      next: () => {
        this.nouveau = { code: '', libelle: '', effectifReference: 1, productionParHeure: 0, productionJournaliere: 0, unite: 'KG', categoriesMetier: [], actif: true };
        this.afficher('Poste créé', 'succes');
        this.charger();
      },
      error: (e) => { this.afficherErreur(e); this.loading.set(false); },
    });
  }

  basculerActif(p: CodePosteRef & { id?: number; actif?: boolean }): void {
    if (!p.id) return;
    this.svc.modifierPosteProduction(p.id, { ...p, actif: !(p.actif ?? true) }).subscribe({
      next: () => this.charger(),
      error: (e) => this.afficherErreur(e),
    });
  }

  supprimer(id: number | undefined): void {
    if (!id) return;
    if (!confirm('Supprimer ce poste ?')) return;
    this.svc.supprimerPosteProduction(id).subscribe({
      next: () => { this.afficher('Poste supprimé', 'succes'); this.charger(); },
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
