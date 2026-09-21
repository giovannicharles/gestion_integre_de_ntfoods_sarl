import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DgService, TauxOccupationSecteurBE, ClassementCommercialBE } from '../../../../dg/infrastructure/dg.service';
import { CommercialService } from '../../../../commercial/infrastructure/commercial.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-rp-zones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rp-zones.component.html',
})
export class RpZonesComponent implements OnInit {
  Math = Math;
  fCFA = fCFA;
  private readonly dgSvc = inject(DgService);
  // Le classement passe par le module commercial : `/api/dg/**` est réservé au
  // Directeur Général, et la Chargée RP y recevait un 403 sur une donnée que la
  // permission COMMERCIAL_VENTE_CONSULTER lui accorde par ailleurs.
  private readonly comSvc = inject(CommercialService);

  occupation = signal<TauxOccupationSecteurBE[]>([]);
  commerciaux = signal<ClassementCommercialBE[]>([]);

  taux(o: TauxOccupationSecteurBE): number {
    return o.tauxOccupationPourcent;
  }
  commercialNom(mat: string): string {
    return this.commerciaux().find(c => c.matricule === mat)?.nomComplet ?? mat;
  }

  ngOnInit(): void {
    this.dgSvc.getTauxOccupationMarches().subscribe({
      next: o => this.occupation.set(o),
      error: () => {},
    });
    this.comSvc.getClassementCommerciaux().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => {},
    });
  }
}
