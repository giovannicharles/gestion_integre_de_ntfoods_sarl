import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DgService, ClassementCommercialBE } from '../../../../dg/infrastructure/dg.service';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-commercial-classement',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './commercial-classement.component.html',
  styleUrls: ['./commercial-classement.component.css']
})
export class CommercialClassementComponent implements OnInit {
  today = new Date();
  private readonly dgSvc = inject(DgService);

  commerciaux = signal<ClassementCommercialBE[]>([]);
  monId = 'COM004';
  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;

  ngOnInit(): void {
    this.dgSvc.getClassement().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => {},
    });
  }

  tauxRealisation(c: ClassementCommercialBE): number {
    const max = Math.max(...this.commerciaux().map(x => x.caRealise), 1);
    return Math.round((c.caRealise / max) * 100);
  }

  isEligible(c: ClassementCommercialBE): boolean {
    return this.tauxRealisation(c) >= 100;
  }
}
