import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DgService, TauxOccupationSecteurBE, ClassementCommercialBE } from '../../../../dg/infrastructure/dg.service';
import { CommercialService } from '../../../../commercial/infrastructure/commercial.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-rp-zones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rp-zones.component.html',
  styleUrl: './rp-zones.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  potentielNonExploite(o: TauxOccupationSecteurBE): number {
    return Math.max(0, o.boutiquesRecensees - o.clientsLivres);
  }

  /** Zones sous-exploitées (potentiel réel à relancer) et saturées (à décharger),
   * calculées depuis les vrais taux d'occupation plutôt qu'un texte figé. */
  zonesSousExploitees = computed(() =>
    this.occupation().filter(o => o.tauxOccupationPourcent < 45 && o.boutiquesRecensees > 0)
      .sort((a, b) => this.potentielNonExploite(b) - this.potentielNonExploite(a))
  );
  zonesSaturees = computed(() =>
    this.occupation().filter(o => o.tauxOccupationPourcent >= 80)
      .sort((a, b) => b.tauxOccupationPourcent - a.tauxOccupationPourcent)
  );

  libelleZonesSaturees(): string {
    return this.zonesSaturees().map(z => `${z.secteur} (${this.taux(z)}%)`).join(', ');
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
