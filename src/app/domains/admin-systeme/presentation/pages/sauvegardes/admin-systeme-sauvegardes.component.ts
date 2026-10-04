import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSystemeService, SauvegardeBE } from '../../../infrastructure/admin-systeme.service';

/**
 * Déclenchement manuel = action directe (sûre, réversible). Modifier la planification
 * automatique = demande soumise au moteur d'approbation (un second membre haut placé doit
 * valider) — jamais appliquée directement depuis cet écran.
 */
@Component({
  selector: 'app-admin-systeme-sauvegardes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-systeme-sauvegardes.component.html',
  styleUrls: ['./admin-systeme-sauvegardes.component.css']
})
export class AdminSystemeSauvegardesComponent implements OnInit {
  private readonly svc = inject(AdminSystemeService);

  sauvegardes = signal<SauvegardeBE[]>([]);
  loading = signal(false);
  declenchementEnCours = signal(false);
  erreur = signal<string | null>(null);
  succes = signal<string | null>(null);

  formPlanification = {
    actif: true,
    frequenceHeures: 24,
    motif: ''
  };
  afficherFormPlanification = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.historiqueSauvegardes(0, 20).subscribe({
      next: (page) => { this.sauvegardes.set(page.contenu); this.loading.set(false); },
      error: () => { this.erreur.set("Impossible de charger l'historique des sauvegardes."); this.loading.set(false); }
    });
  }

  declencher(): void {
    this.declenchementEnCours.set(true);
    this.erreur.set(null);
    this.svc.declencherSauvegarde().subscribe({
      next: (s) => {
        this.sauvegardes.set([s, ...this.sauvegardes()]);
        this.declenchementEnCours.set(false);
        this.succes.set(s.statut === 'REUSSIE' ? 'Sauvegarde réussie.' : 'Sauvegarde échouée — voir détail.');
        setTimeout(() => this.succes.set(null), 4000);
      },
      error: (err) => {
        this.declenchementEnCours.set(false);
        this.erreur.set(err?.error?.erreur ?? 'Échec du déclenchement de la sauvegarde.');
      }
    });
  }

  demanderModificationPlanification(): void {
    const motif = this.formPlanification.motif.trim();
    if (!motif) {
      this.erreur.set('Le motif est obligatoire.');
      return;
    }
    this.erreur.set(null);
    this.svc.demanderModificationPlanification(this.formPlanification.actif, this.formPlanification.frequenceHeures, motif)
      .subscribe({
        next: () => {
          this.succes.set("Demande de modification de la planification créée — en attente d'approbation.");
          this.afficherFormPlanification.set(false);
          this.formPlanification.motif = '';
          setTimeout(() => this.succes.set(null), 4000);
        },
        error: (err) => this.erreur.set(err?.error?.erreur ?? 'Échec de la demande.')
      });
  }
}
