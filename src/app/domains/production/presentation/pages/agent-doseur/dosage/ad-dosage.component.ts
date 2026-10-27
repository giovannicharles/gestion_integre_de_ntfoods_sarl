import { Component, OnInit, OnDestroy, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionDosageBE } from '../../../../infrastructure/production.service';
import { AdSessionContextService } from '../ad-session-context.service';
import { extractApiError } from '../../../../../../core/http/api-error-parser';

/**
 * DOSAGE DES MATIÈRES PREMIÈRES — Agent Doseur
 *
 * La composition (quelles matières, quelles quantités) est désormais calculée côté serveur depuis la
 * formulation réelle du produit bouillie du plan en cours — fini le choix manuel entre deux ratios figés,
 * qui pouvait se tromper de recette. Si aucune formulation n'est identifiable sans ambiguïté, le serveur le
 * signale explicitement ; la saisie manuelle ci-dessous reste alors disponible.
 *
 * La sélection de la session de travail est entièrement déléguée à
 * `AdSessionContextService` (plus de logique dupliquée ici).
 */
@Component({
  selector: 'app-ad-dosage',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './ad-dosage.component.html',
  styleUrls: ['./ad-dosage.component.css', '../_shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdDosageComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ProductionService);
  readonly contexte = inject(AdSessionContextService);

  message = signal('');
  loading = signal(false);
  session = signal<SessionDosageBE | null>(null);

  nbFutsProduits = 1;
  observations = '';
  autresMatieres: { typeMatiere: string; quantiteKg: number }[] = [];
  nouvelleAutreMatiere = { typeMatiere: '', quantiteKg: 0 };

  private autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.contexte.chargerSessionsOuvertes();
  }

  ngOnDestroy(): void {
    this.annulerAutoSave();
  }

  /** Sélection depuis le `<select>` — délègue au contexte partagé. */
  selectionnerSessionDepuisSelect(value: string): void {
    this.contexte.selectionnerParId(value);
  }

  /** Appelé à chaque modification du nombre de fûts. */
  onDosageInputChange(): void {
    this.annulerAutoSave();
    if (!this.contexte.sessionActive() || this.nbFutsProduits < 0) return;
    this.autoSaveTimeout = setTimeout(() => this.appliquerDosageAutomatique(), 600);
  }

  private appliquerDosageAutomatique(): void {
    const active = this.contexte.sessionActive();
    if (!active) return;
    this.loading.set(true);
    this.svc.mettreAJourDosageAutomatique(active.id, this.nbFutsProduits).subscribe({
      next: s => {
        this.session.set(s);
        this.loading.set(false);
        this.message.set('Dosage automatique mis à jour côté serveur');
      },
      error: err => {
        this.loading.set(false);
        this.message.set(extractApiError(err));
      },
    });
  }

  private annulerAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
  }

  ajouterAutreMatiere(): void {
    if (!this.nouvelleAutreMatiere.typeMatiere || this.nouvelleAutreMatiere.quantiteKg <= 0) return;
    this.autresMatieres.push({ ...this.nouvelleAutreMatiere });
    this.nouvelleAutreMatiere = { typeMatiere: '', quantiteKg: 0 };
  }

  retirerAutreMatiere(i: number): void {
    this.autresMatieres.splice(i, 1);
  }

  enregistrerDosage(): void {
    const active = this.contexte.sessionActive();
    if (!active) { this.message.set('Aucune session ouverte sélectionnée'); return; }
    if (this.autresMatieres.length === 0) { this.message.set('Aucune autre matière à enregistrer'); return; }

    const id = active.id;
    const appels = this.autresMatieres.map(m => this.svc.enregistrerMatiereDosage(id, m.typeMatiere, m.quantiteKg));

    let dernier: SessionDosageBE | null = null;
    const executerSequentiellement = (index: number): void => {
      if (index >= appels.length) {
        this.session.set(dernier);
        this.message.set('Autres matières enregistrées');
        return;
      }
      appels[index].subscribe({
        next: s => { dernier = s; executerSequentiellement(index + 1); },
        error: () => this.message.set("Erreur lors de l'enregistrement des autres matières"),
      });
    };
    executerSequentiellement(0);
  }
}
