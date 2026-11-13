import { Component, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../../core/services/toast.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface LigneRapprochement {
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

  compteSelectionne = signal<'AFRILAND' | 'BICEC'>('AFRILAND');
  soldeReleveBancaire = signal(48500000);
  soldeComptableERP = signal(46850000);

  lignesSuspension = signal<LigneRapprochement[]>([
    {
      id: 1,
      dateOperation: '2026-10-30',
      referencePiece: 'CHQ-88412',
      libelle: 'Chèque émis Fournisseur Tapioca Batouri (En circulation non compensé)',
      debit: 0,
      credit: 2450000,
      sens: 'CREDIT',
      estRapproche: false,
      type: 'CHEQUE_CIRCULATION'
    },
    {
      id: 2,
      dateOperation: '2026-10-31',
      referencePiece: 'VIR-90415',
      libelle: 'Virement Client DOVV Yaoundé (Crédité en banque non saisi en caisse)',
      debit: 4100000,
      credit: 0,
      sens: 'DEBIT',
      estRapproche: false,
      type: 'VIREMENT_ATTENTE'
    },
    {
      id: 3,
      dateOperation: '2026-10-31',
      referencePiece: 'AGIOS-1026',
      libelle: 'Frais de tenue de compte & commissions mouvements Afriland',
      debit: 0,
      credit: 45000,
      sens: 'CREDIT',
      estRapproche: false,
      type: 'FRAIS_BANCAIRES'
    }
  ]);

  constructor(private toast: ToastService) {}

  ngOnInit(): void {}

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
    this.toast.success('État de rapprochement mensuel validé et archivé avec succès !');
  }
}

