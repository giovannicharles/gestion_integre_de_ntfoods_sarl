import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-preloader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preloader.component.html',
  styleUrls: ['./preloader.component.css']
})
export class PreloaderComponent implements OnInit {
  loading = true;

  /**
   * Grille 3×3 du loader (2026-10-25, demande explicite du porteur : « améliore le preloader
   * avec une grille »). Valeurs = somme diagonale (ligne+colonne) de chaque cellule en ordre de
   * lecture, utilisée comme multiplicateur du délai d'animation → effet d'onde diagonale plutôt
   * qu'un simple décalage linéaire.
   */
  readonly loaderCells = [0, 1, 2, 1, 2, 3, 2, 3, 4];

  ngOnInit() {
    // Simuler le chargement initial
    setTimeout(() => {
      this.loading = false;
    }, 2000);
  }
}
