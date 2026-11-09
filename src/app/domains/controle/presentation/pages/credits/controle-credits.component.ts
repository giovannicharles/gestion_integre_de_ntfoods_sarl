import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommercialService, RecouvrementBE } from '../../../../commercial/infrastructure/commercial.service';
import { ClassementCommercialBE } from '../../../../dg/infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-controle-credits',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './controle-credits.component.html',
  styleUrls: ['./controle-credits.component.css'],
})
export class ControleCreditsComponent implements OnInit {
  fCFA = fCFA;
  private readonly comSvc = inject(CommercialService);

  recouvrements = signal<RecouvrementBE[]>([]);
  commerciaux = signal<ClassementCommercialBE[]>([]);

  debiteurs = computed(() =>
    this.recouvrements().filter(r => r.montantRestant > 0)
      .sort((a, b) => b.montantRestant - a.montantRestant)
  );
  totalCredit = computed(() =>
    this.recouvrements().reduce((s, r) => s + r.montantRestant, 0)
  );

  parCommercial = computed(() => this.commerciaux().map(com => ({
    nom: com.nomComplet,
    zone: '-',
    total: this.recouvrements().filter(r => r.matriculeCommercial === com.matricule).reduce((s, r) => s + r.montantRestant, 0),
    nbClients: this.recouvrements().filter(r => r.matriculeCommercial === com.matricule && r.montantRestant > 0).length,
  })).sort((a, b) => b.total - a.total));

  commercialNom(mat: string): string {
    return this.commerciaux().find(c => c.matricule === mat)?.nomComplet ?? mat;
  }

  /** Oversight crédit (2026-11-09, proposé et implémenté suite à la demande du porteur) : le
   * Contrôleur Général évalue le risque crédit, pas seulement le montant dû - une dette récente
   * n'est pas le même risque qu'une dette ancienne du même montant. dateEcheance existe déjà sur
   * RecouvrementBE, jamais exploité pour calculer un retard. */
  joursRetard(r: RecouvrementBE): number {
    if (!r.dateEcheance) return 0;
    const ms = new Date().getTime() - new Date(r.dateEcheance).getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  }

  niveauRisque(r: RecouvrementBE): 'critique' | 'alerte' | 'normal' {
    const j = this.joursRetard(r);
    return j > 30 ? 'critique' : j > 15 ? 'alerte' : 'normal';
  }

  ngOnInit(): void {
    this.comSvc.getRecouvrements().subscribe({
      next: r => this.recouvrements.set(r),
      error: () => {},
    });
    // Par le module commercial et non par `/api/dg/**`, réservé au DG : le
    // Contrôleur Général y recevait un 403 sur un classement identique auquel
    // COMMERCIAL_VENTE_CONSULTER lui donne droit.
    this.comSvc.getClassementCommerciaux().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => {},
    });
  }
}
