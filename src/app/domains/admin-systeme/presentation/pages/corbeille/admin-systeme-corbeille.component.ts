import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSystemeService, ElementCorbeilleBE } from '../../../infrastructure/admin-systeme.service';

/**
 * Corbeille (§7.3 du contexte projet) — la restauration ne s'exécute jamais ici : elle crée une
 * demande sur le moteur d'approbation, qu'un DG/Contrôleur général/Admin doit ensuite valider
 * (écran « Mes validations », déjà existant — pas dupliqué ici).
 */
@Component({
  selector: 'app-admin-systeme-corbeille',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-systeme-corbeille.component.html',
  styleUrls: ['./admin-systeme-corbeille.component.css']
})
export class AdminSystemeCorbeilleComponent implements OnInit {
  private readonly svc = inject(AdminSystemeService);

  elements = signal<ElementCorbeilleBE[]>([]);
  loading = signal(false);
  erreur = signal<string | null>(null);
  succes = signal<string | null>(null);

  motifParElement: Record<string, string> = {};

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.corbeille().subscribe({
      next: (liste) => { this.elements.set(liste); this.loading.set(false); },
      error: () => { this.erreur.set('Impossible de charger la corbeille.'); this.loading.set(false); }
    });
  }

  cle(e: ElementCorbeilleBE): string {
    return e.typeEntite + '-' + e.id;
  }

  demanderRestauration(e: ElementCorbeilleBE): void {
    const motif = (this.motifParElement[this.cle(e)] ?? '').trim();
    if (!motif) {
      this.erreur.set('Le motif est obligatoire pour demander une restauration.');
      return;
    }
    this.erreur.set(null);
    this.svc.demanderRestauration(e.typeEntite, e.id, motif).subscribe({
      next: () => {
        this.succes.set(`Demande de restauration créée pour ${e.reference} — en attente d'approbation.`);
        setTimeout(() => this.succes.set(null), 4000);
      },
      error: (err) => this.erreur.set(err?.error?.erreur ?? 'Échec de la demande de restauration.')
    });
  }
}
