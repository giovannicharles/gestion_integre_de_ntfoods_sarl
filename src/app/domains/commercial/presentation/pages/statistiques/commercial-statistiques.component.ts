import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-commercial-statistiques',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './commercial-statistiques.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialStatistiquesComponent {
  fCFA = fCFA;

  caMoisFCFA = signal(4_850_000);
  objectifMoisFCFA = signal(6_000_000);
  primeAcquiseFCFA = signal(145_500);

  get tauxRealisation(): number {
    return Math.round((this.caMoisFCFA() / this.objectifMoisFCFA()) * 100);
  }

  ventesParGamme = signal([
    { gamme: 'Bouillies Composées (Soja, Maïs, Riz)', cartons: 380, caFCFA: 2_280_000, part: 47 },
    { gamme: 'Farines Infantiles 1er & 2e Âge', cartons: 195, caFCFA: 1_170_000, part: 24 },
    { gamme: 'Chips Plantain & Amuse-Gueules', cartons: 140, caFCFA: 700_000, part: 14 },
    { gamme: 'Huiles & Sauces Traditionnelles', cartons: 75, caFCFA: 450_000, part: 10 },
    { gamme: 'Miel Pur Tanty & Confitures', cartons: 35, caFCFA: 250_000, part: 5 }
  ]);

  ventesParSecteur = signal([
    { secteur: 'Mokolo & Tsinga', clients: 48, caFCFA: 1_850_000, tauxCouverture: 88 },
    { secteur: 'Cité Verte & Madagascar', clients: 35, caFCFA: 1_220_000, tauxCouverture: 79 },
    { secteur: 'Bastos & Dragages', clients: 22, caFCFA: 980_000, tauxCouverture: 72 },
    { secteur: 'Biyem-Assi & Mendong', clients: 20, caFCFA: 800_000, tauxCouverture: 65 }
  ]);
}
