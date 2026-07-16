import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommercialService, RecouvrementBE } from '../../../../commercial/infrastructure/commercial.service';
import { DgService, ClassementCommercialBE } from '../../../../dg/infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-controle-credits',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './controle-credits.component.html',
})
export class ControleCreditsComponent implements OnInit {
  fCFA = fCFA;
  private readonly comSvc = inject(CommercialService);
  private readonly dgSvc = inject(DgService);

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
    zone: '—',
    total: this.recouvrements().filter(r => r.matriculeCommercial === com.matricule).reduce((s, r) => s + r.montantRestant, 0),
    nbClients: this.recouvrements().filter(r => r.matriculeCommercial === com.matricule && r.montantRestant > 0).length,
  })).sort((a, b) => b.total - a.total));

  commercialNom(mat: string): string {
    return this.commerciaux().find(c => c.matricule === mat)?.nomComplet ?? mat;
  }

  ngOnInit(): void {
    this.comSvc.getRecouvrements().subscribe({
      next: r => this.recouvrements.set(r),
      error: () => {},
    });
    this.dgSvc.getClassement().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => {},
    });
  }
}
