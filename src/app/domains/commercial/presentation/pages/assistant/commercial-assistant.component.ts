import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-commercial-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './commercial-assistant.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialAssistantComponent {
  fCFA = fCFA;

  // Simulateur Remise Volume
  quantiteCartons = signal<number>(25);
  prixCartonStandard = signal<number>(12_000);

  // Simulateur Marge Revendeur
  prixVenteDetailUnite = signal<number>(600);
  unitesParCarton = signal<number>(24);

  get tauxRemise(): number {
    const q = this.quantiteCartons();
    if (q >= 100) return 10;
    if (q >= 50) return 7;
    if (q >= 20) return 4;
    if (q >= 10) return 2;
    return 0;
  }

  get prixCartonRemise(): number {
    return Math.round(this.prixCartonStandard() * (1 - this.tauxRemise / 100));
  }

  get totalSansRemise(): number {
    return this.quantiteCartons() * this.prixCartonStandard();
  }

  get totalAvecRemise(): number {
    return this.quantiteCartons() * this.prixCartonRemise;
  }

  get economieClient(): number {
    return this.totalSansRemise - this.totalAvecRemise;
  }

  // Marge Revendeur
  get caRevendeurCarton(): number {
    return this.prixVenteDetailUnite() * this.unitesParCarton();
  }

  get beneficeNetRevendeurCarton(): number {
    return this.caRevendeurCarton - this.prixCartonRemise;
  }

  get margePourcentRevendeur(): number {
    if (this.caRevendeurCarton === 0) return 0;
    return Math.round((this.beneficeNetRevendeurCarton / this.caRevendeurCarton) * 100);
  }
}
