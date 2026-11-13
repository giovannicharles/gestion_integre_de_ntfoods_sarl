import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface EncaissementJournal {
  id: string;
  heure: string;
  commercial: string;
  mode: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  montantFCFA: number;
  quittanceNumero: string;
}

@Component({
  selector: 'app-secretaire-reporting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './secretaire-reporting.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecretaireReportingComponent {
  fCFA = fCFA;

  lignes = signal<EncaissementJournal[]>([
    { id: 'ENC-01', heure: '08:30', commercial: 'FOKOU Alain (COM-001)', mode: 'ESPECES', montantFCFA: 340_000, quittanceNumero: 'QUIT-8901' },
    { id: 'ENC-02', heure: '10:15', commercial: 'TALLA Jean (COM-002)', mode: 'ESPECES', montantFCFA: 520_000, quittanceNumero: 'QUIT-8902' },
    { id: 'ENC-03', heure: '11:45', commercial: 'SUPERMARCHÉ DOVV (Client Direct)', mode: 'CHEQUE', montantFCFA: 1_250_000, quittanceNumero: 'CHQ-BICEC-441' },
    { id: 'ENC-04', heure: '14:20', commercial: 'KAMGA Eric (COM-004)', mode: 'ESPECES', montantFCFA: 280_000, quittanceNumero: 'QUIT-8903' },
  ]);

  get totalEspeces(): number {
    return this.lignes().filter(l => l.mode === 'ESPECES').reduce((s, l) => s + l.montantFCFA, 0);
  }

  get totalCheques(): number {
    return this.lignes().filter(l => l.mode === 'CHEQUE').reduce((s, l) => s + l.montantFCFA, 0);
  }

  get totalGlobal(): number {
    return this.lignes().reduce((s, l) => s + l.montantFCFA, 0);
  }
}
