import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface DocMagasin {
  id: string;
  reference: string;
  type: string;
  titre: string;
  magasin: string;
  date: string;
  statut: 'SIGNE' | 'EN_ATTENTE';
}

@Component({
  selector: 'app-stock-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-documents.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StockDocumentsComponent {
  documents = signal<DocMagasin[]>([
    {
      id: 'DOC-STK-01',
      reference: 'INV-2026-10-NSAM',
      type: 'Procès-Verbal',
      titre: 'PV Inventaire Général Contradictoire Magasin Central',
      magasin: 'Yaoundé Nsam',
      date: '31/10/2026',
      statut: 'SIGNE'
    },
    {
      id: 'DOC-STK-02',
      reference: 'TRF-BASSA-089',
      type: 'Bordereau Transfert',
      titre: 'Bordereau d’Expédition Usine Bassa vers Magasin Central',
      magasin: 'Douala Bassa',
      date: '11/11/2026',
      statut: 'SIGNE'
    },
    {
      id: 'DOC-STK-03',
      reference: 'DECH-VEH-014',
      type: 'Fiche Dotation',
      titre: 'Décharge Dotation Quotidienne Véhicule Commercial LT-842',
      magasin: 'Flotte Mobile Littoral',
      date: '13/11/2026',
      statut: 'SIGNE'
    },
    {
      id: 'DOC-STK-04',
      reference: 'FICHE-CASIER-SOJA',
      type: 'Fiche Casier',
      titre: 'Fiche de Suivi Casier Matières Premières - Soja Trié Batouri',
      magasin: 'Silo Batouri',
      date: '05/11/2026',
      statut: 'SIGNE'
    }
  ]);
}
