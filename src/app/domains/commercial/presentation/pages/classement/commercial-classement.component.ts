import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ClassementCommercialBE } from '../../../../dg/infrastructure/dg.service';
import { CommercialService } from '../../../infrastructure/commercial.service';
import { AuthService } from '../../../../../core/auth/auth.service';
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
  // `/api/dg/**` est réservé au Directeur Général ; le commercial y recevait un
  // 403 sur son propre classement. La même donnée passe par le module
  // commercial, sous la permission COMMERCIAL_VENTE_CONSULTER qu'il détient.
  private readonly comSvc = inject(CommercialService);
  private readonly auth = inject(AuthService);

  commerciaux = signal<ClassementCommercialBE[]>([]);
  /**
   * Matricule de l'utilisateur connecté, qui sert à mettre en évidence sa
   * propre ligne. Il était figé à `COM004` — un matricule qui n'existe pas :
   * la ligne surlignée n'était donc jamais la bonne, et pour tout le monde la
   * même. Il vient maintenant de la session.
   */
  monId = signal<string>('');
  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;

  ngOnInit(): void {
    this.monId.set(this.auth.user()?.matricule ?? '');
    this.comSvc.getClassementCommerciaux().subscribe({
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
