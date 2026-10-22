import { Injectable, signal } from '@angular/core';

/**
 * Horloge partagée : une seule mise à jour toutes les 30s, consommée par tous les layouts
 * (avant cette classe, 9 layouts ouvraient chacun leur propre setInterval pour le même usage).
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  readonly now = signal(new Date());

  constructor() {
    setInterval(() => this.now.set(new Date()), 30000);
  }
}
