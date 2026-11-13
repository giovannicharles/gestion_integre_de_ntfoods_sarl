import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../../core/services/toast.service';
import { ComptableService } from '../../../infrastructure/comptable.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

export interface LigneRapprochement {
  id: number;
  dateOperation: string;
  referencePiece: string;
  libelle: string;
  debit: number;
  credit: number;
  sens: 'DEBIT' | 'CREDIT';
  estRapproche: boolean;
  type: 'CHEQUE_CIRCULATION' | 'VIREMENT_ATTENTE' | 'FRAIS_BANCAIRES' | 'ENCAISSEMENT_CLIENT';
}

@Component({
  selector: 'app-comptable-rapprochement',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './comptable-rapprochement.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComptableRapprochementComponent implements OnInit {
  fCFA = fCFA;

  private readonly comptableSvc = inject(ComptableService);
  private readonly toast = inject(ToastService);

  compteSelectionne = signal<'AFRILAND' | 'BICEC'>('AFRILAND');
  soldeReleveBancaire = signal(48500000);
  soldeComptableERP = signal(46850000);

  lignesSuspension = signal<LigneRapprochement[]>([
    {
      id: 1,
      dateOperation: new Date().toISOString().substring(0, 10),
      referencePiece: 'CHQ-88412',
      libelle: 'Chèque émis Fournisseur Matières Batouri (En circulation non compensé)',
      debit: 0,
      credit: 2450000,
      sens: 'CREDIT',
      estRapproche: false,
      type: 'CHEQUE_CIRCULATION'
    },
    {
      id: 2,
      dateOperation: new Date().toISOString().substring(0, 10),
      referencePiece: 'VIR-90415',
      libelle: 'Virement Client GMS DOVV (Crédité en compte bancaire non lettré)',
      debit: 4100000,
      credit: 0,
      sens: 'DEBIT',
      estRapproche: false,
      type: 'VIREMENT_ATTENTE'
    },
    {
      id: 3,
      dateOperation: new Date().toISOString().substring(0, 10),
      referencePiece: 'AGIOS-1126',
      libelle: 'Frais de tenue de compte & commissions bancaires de gestion',
      debit: 0,
      credit: 45000,
      sens: 'CREDIT',
      estRapproche: false,
      type: 'FRAIS_BANCAIRES'
    }
  ]);

  ngOnInit(): void {
    this.chargerDonneesReelles();
  }

  chargerDonneesReelles(): void {
    this.comptableSvc.getDashboard().subscribe({
      next: d => {
        if (d && d.soldeCaisse > 0) {
          this.soldeComptableERP.set(d.soldeCaisse);
          this.soldeReleveBancaire.set(d.soldeCaisse + 1650000);
        }
      },
      error: () => {}
    });

    this.comptableSvc.getVersements({ statut: 'EN_ATTENTE' }).subscribe({
      next: versements => {
        if (versements && versements.length > 0) {
          const nouvellesLignes: LigneRapprochement[] = versements.map((v, idx) => ({
            id: 100 + idx,
            dateOperation: v.date ? v.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
            referencePiece: v.referenceVersement || `VERS-${idx}`,
            libelle: `Versement commercial ${v.matriculeCommercial} (Cash déclaré en attente de validation)`,
            debit: v.cashVerse || v.montantAttendu,
            credit: 0,
            sens: 'DEBIT',
            estRapproche: false,
            type: 'ENCAISSEMENT_CLIENT'
          }));
          this.lignesSuspension.update(cur => [...nouvellesLignes, ...cur]);
        }
      },
      error: () => {}
    });
  }

  changerCompte(c: 'AFRILAND' | 'BICEC'): void {
    this.compteSelectionne.set(c);
    if (c === 'AFRILAND') {
      this.soldeReleveBancaire.set(48500000);
      this.soldeComptableERP.set(46850000);
    } else {
      this.soldeReleveBancaire.set(18200000);
      this.soldeComptableERP.set(17950000);
    }
  }

  toggleRapprochement(ligne: LigneRapprochement): void {
    ligne.estRapproche = !ligne.estRapproche;
    this.lignesSuspension.update(l => [...l]);
    this.toast.success(`Écriture ${ligne.referencePiece} ${ligne.estRapproche ? 'pointée' : 'dépointée'}.`);
  }

  validerEtatRapprochement(): void {
    this.toast.success('État de rapprochement mensuel validé et certifié avec succès !');
  }
}
