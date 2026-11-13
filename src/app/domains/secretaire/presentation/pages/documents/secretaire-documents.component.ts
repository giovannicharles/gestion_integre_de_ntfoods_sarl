import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CourrierAdmin {
  id: string;
  reference: string;
  date: string;
  type: 'ENTRANT' | 'SORTANT';
  expediteurDestinataire: string;
  objet: string;
  statut: 'TRAITE' | 'EN_COURS' | 'CLASSE';
}

@Component({
  selector: 'app-secretaire-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './secretaire-documents.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecretaireDocumentsComponent {
  filtreType = signal<'TOUS' | 'ENTRANT' | 'SORTANT'>('TOUS');

  courriers = signal<CourrierAdmin[]>([
    {
      id: 'ADM-01',
      reference: 'CE-2026/042',
      date: '13/11/2026',
      type: 'ENTRANT',
      expediteurDestinataire: 'MINADER (Délégation Régionale)',
      objet: 'Convocation réunion de concertation sur la filière soja et maïs local.',
      statut: 'TRAITE'
    },
    {
      id: 'ADM-02',
      reference: 'CS-2026/088',
      date: '12/11/2026',
      type: 'SORTANT',
      expediteurDestinataire: 'Direction Générale des Douanes (Douala Port)',
      objet: 'Transmission dossier de dédouanement équipements d’emballage.',
      statut: 'EN_COURS'
    },
    {
      id: 'ADM-03',
      reference: 'CE-2026/041',
      date: '10/11/2026',
      type: 'ENTRANT',
      expediteurDestinataire: 'Afriland First Bank (Agence Hippodrome)',
      objet: 'Attestation de domiciliation bancaire et relevés certifiés pour appel d’offres.',
      statut: 'CLASSE'
    },
    {
      id: 'ADM-04',
      reference: 'CS-2026/087',
      date: '08/11/2026',
      type: 'SORTANT',
      expediteurDestinataire: 'Société Hygiène et Salubrité du Cameroun (HYSACAM)',
      objet: 'Renouvellement contrat d’évacuation des résidus d’usine Bassa.',
      statut: 'TRAITE'
    }
  ]);

  get courriersFiltres(): CourrierAdmin[] {
    const f = this.filtreType();
    if (f === 'TOUS') return this.courriers();
    return this.courriers().filter(c => c.type === f);
  }
}
