import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-secretaire-statistiques',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './secretaire-statistiques.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecretaireStatistiquesComponent {
  totalPrecommandes = signal(148);
  tauxValidation = signal(96);
  tempsMoyenTraitementMinutes = signal(14);

  statsCommerciaux = signal([
    { nom: 'FOKOU Alain', precommandes: 38, conformes: 37, tauxConformite: 97 },
    { nom: 'TALLA Jean', precommandes: 42, conformes: 40, tauxConformite: 95 },
    { nom: 'KAMGA Eric', precommandes: 36, conformes: 35, tauxConformite: 97 },
    { nom: 'NGOUO Marc', precommandes: 32, conformes: 30, tauxConformite: 94 }
  ]);
}
