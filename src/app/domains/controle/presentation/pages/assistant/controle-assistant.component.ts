import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-controle-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './controle-assistant.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControleAssistantComponent {
  fCFA = fCFA;

  // Calcul du Point Mort (Seuil de Rentabilité)
  chargesFixesAnnuellesFCFA = signal<number>(45_000_000);
  prixVenteCartonMoyenFCFA = signal<number>(12_500);
  coutVariableCartonFCFA = signal<number>(7_800);

  get margeSurCoutVariableCarton(): number {
    return this.prixVenteCartonMoyenFCFA() - this.coutVariableCartonFCFA();
  }

  get tauxMargeSurCoutVariable(): number {
    if (this.prixVenteCartonMoyenFCFA() === 0) return 0;
    return Math.round((this.margeSurCoutVariableCarton / this.prixVenteCartonMoyenFCFA()) * 100);
  }

  get seuilRentabiliteFCFA(): number {
    if (this.tauxMargeSurCoutVariable === 0) return 0;
    return Math.round(this.chargesFixesAnnuellesFCFA() / (this.tauxMargeSurCoutVariable / 100));
  }

  get pointMortCartons(): number {
    if (this.margeSurCoutVariableCarton <= 0) return 0;
    return Math.ceil(this.chargesFixesAnnuellesFCFA() / this.margeSurCoutVariableCarton);
  }

  get pointMortCartonsParMois(): number {
    return Math.ceil(this.pointMortCartons / 12);
  }
}
