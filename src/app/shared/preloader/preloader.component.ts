import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-preloader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preloader.component.html',
  styleUrls: ['./preloader.component.css']
})
export class PreloaderComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private sub?: Subscription;
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  loading = true;
  closing = signal(false);
  stepText = signal('Initialisation de l\'environnement sécurisé…');
  progressPct = signal(28);
  slowWakeup = signal(false);

  /**
   * Grille 3×3 du loader : valeurs = somme diagonale (ligne+colonne) de chaque cellule
   * en ordre de lecture, utilisée comme multiplicateur du délai d'animation → onde diagonale.
   */
  readonly loaderCells = [0, 1, 2, 1, 2, 3, 2, 3, 4];

  ngOnInit(): void {
    // Progression par étapes réelles + écoute de la première navigation Angular
    this.timers.push(
      setTimeout(() => {
        this.stepText.set('Chargement des modules métier NTFOODS…');
        this.progressPct.set(68);
      }, 320),
      setTimeout(() => {
        this.stepText.set('Vérification de la session et des habilitations…');
        this.progressPct.set(92);
      }, 680),
      // Si la première route a déjà résolu ou après un court délai max fluide (950 ms)
      setTimeout(() => this.finishLoading(), 950),
      // Garde-fou si le serveur Render met du temps à se réveiller
      setTimeout(() => {
        if (this.loading) {
          this.slowWakeup.set(true);
          this.stepText.set('Le serveur se réveille, ouverture de l\'interface…');
        }
      }, 2200)
    );

    this.sub = this.router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd || ev instanceof NavigationCancel || ev instanceof NavigationError) {
        this.progressPct.set(100);
        // Laisse 450 ms minimum pour que l'onde visuelle ne clignote pas brutalement
        this.timers.push(setTimeout(() => this.finishLoading(), 450));
        this.sub?.unsubscribe();
      }
    });
  }

  dismissNow(): void {
    this.finishLoading();
  }

  private finishLoading(): void {
    if (!this.loading || this.closing()) return;
    this.progressPct.set(100);
    this.closing.set(true);
    this.timers.push(
      setTimeout(() => {
        this.loading = false;
      }, 240)
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.timers.forEach((t) => clearTimeout(t));
  }
}
