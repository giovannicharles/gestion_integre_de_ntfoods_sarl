import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ClassementCommercialBE } from '../../../../dg/infrastructure/dg.service';
import { CommercialService } from '../../../infrastructure/commercial.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-commercial-classement',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './commercial-classement.component.html',
  styleUrls: ['./commercial-classement.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialClassementComponent implements OnInit {
  today = new Date();
  // `/api/dg/**` est réservé au Directeur Général ; le commercial y recevait un
  // 403 sur son propre classement. La même donnée passe par le module
  // commercial, sous la permission COMMERCIAL_VENTE_CONSULTER qu'il détient.
  private readonly comSvc = inject(CommercialService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

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
      error: () => this.toast.error('Impossible de charger le classement'),
    });
  }

  /**
   * Numéro de semaine ISO-8601 réel, calculé côté client — remplace le libellé
   * fixe « S26-2026 » qui restait affiché quelle que soit la semaine réelle
   * (trouvé en vérifiant l'écran en direct, pas en lisant le code seul).
   */
  get numeroSemaine(): string {
    const d = new Date(Date.UTC(this.today.getFullYear(), this.today.getMonth(), this.today.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semaine = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `S${semaine}-${d.getUTCFullYear()}`;
  }

  tauxRealisation(c: ClassementCommercialBE): number {
    const max = Math.max(...this.commerciaux().map(x => x.caRealise), 1);
    return Math.round((c.caRealise / max) * 100);
  }

  isEligible(c: ClassementCommercialBE): boolean {
    return this.tauxRealisation(c) >= 100;
  }
}
