import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RpService, OccupationMarcheResponse } from '../../../infrastructure/rp.service';
import { CommercialService } from '../../../../commercial/infrastructure/commercial.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

export interface GammeStatUI {
  gamme: string;
  cartonsVendus: number;
  partVolume: number;
  chiffreAffaires: number;
  tauxAtteinte: number;
}

@Component({
  selector: 'app-rp-statistiques',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rp-statistiques.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RpStatistiquesComponent implements OnInit {
  fCFA = fCFA;
  Math = Math;

  private readonly rpSvc = inject(RpService);
  private readonly commercialSvc = inject(CommercialService);

  loading = signal(true);
  secteurs = signal<OccupationMarcheResponse[]>([]);
  gammes = signal<GammeStatUI[]>([]);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);

    this.rpSvc.getDashboard().subscribe({
      next: dash => {
        if (dash.occupation?.length) {
          this.secteurs.set(dash.occupation);
        }
        if (dash.gammes?.length) {
          const totalCa = dash.gammes.reduce((acc, g) => acc + (g.ca || 0), 0);
          const stats: GammeStatUI[] = dash.gammes.map(g => ({
            gamme: g.gamme,
            cartonsVendus: Math.round((g.ca || 0) / 15000),
            partVolume: totalCa > 0 ? Math.round(((g.ca || 0) / totalCa) * 100) : 0,
            chiffreAffaires: g.ca || 0,
            tauxAtteinte: g.objectif > 0 ? Math.min(100, Math.round(((g.ca || 0) / g.objectif) * 100)) : 0
          }));
          this.gammes.set(stats);
        } else {
          this.gammes.set([]);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  totalBoutiquesRepertoriees = () => this.secteurs().reduce((a, b) => a + (b.repertoriees || 0), 0);
  totalBoutiquesLivrees = () => this.secteurs().reduce((a, b) => a + (b.livrees || 0), 0);
  tauxCouvertureGlobal = () => {
    const rep = this.totalBoutiquesRepertoriees();
    return rep > 0 ? Math.round((this.totalBoutiquesLivrees() / rep) * 100) : 0;
  };
  totalCaGammes = () => this.gammes().reduce((a, b) => a + b.chiffreAffaires, 0);

  tauxCouvertureSecteur(s: OccupationMarcheResponse): number {
    if (!s.repertoriees || s.repertoriees <= 0) return 0;
    return Math.round((s.livrees / s.repertoriees) * 100);
  }
}
