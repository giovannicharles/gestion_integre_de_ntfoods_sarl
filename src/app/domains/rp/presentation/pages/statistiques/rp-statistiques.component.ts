import { Component, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface RegionStat {
  region: string;
  pointsDeVenteRepertories: number;
  pointsDeVenteActifs: number;
  tauxCouverture: number;
  caMensuel: number;
  croissancePct: number;
}

interface GammeStat {
  gamme: string;
  cartonsVendus: number;
  partVolume: number;
  chiffreAffaires: number;
  ruptureLineairePct: number;
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

  regions = signal<RegionStat[]>([
    { region: 'Littoral (Douala, Bassa, Bonabéri)', pointsDeVenteRepertories: 240, pointsDeVenteActifs: 198, tauxCouverture: 82.5, caMensuel: 18500000, croissancePct: 14.2 },
    { region: 'Centre (Yaoundé, Mokolo, Bastos)', pointsDeVenteRepertories: 210, pointsDeVenteActifs: 172, tauxCouverture: 81.9, caMensuel: 15400000, croissancePct: 11.8 },
    { region: 'Ouest (Bafoussam, Dschang, Foumban)', pointsDeVenteRepertories: 115, pointsDeVenteActifs: 78, tauxCouverture: 67.8, caMensuel: 6800000, croissancePct: 8.5 },
    { region: 'Sud (Kribi, Ebolowa)', pointsDeVenteRepertories: 65, pointsDeVenteActifs: 42, tauxCouverture: 64.6, caMensuel: 3400000, croissancePct: 6.2 },
    { region: 'Grand Nord (Garoua, Maroua)', pointsDeVenteRepertories: 80, pointsDeVenteActifs: 39, tauxCouverture: 48.7, caMensuel: 2900000, croissancePct: 18.0 }
  ]);

  gammes = signal<GammeStat[]>([
    { gamme: 'Tapioca Tanty Spécial (1kg & 500g)', cartonsVendus: 4200, partVolume: 42, chiffreAffaires: 21000000, ruptureLineairePct: 2.1 },
    { gamme: 'Farine & Bouillie Infantile Tanty', cartonsVendus: 2800, partVolume: 28, chiffreAffaires: 15400000, ruptureLineairePct: 3.4 },
    { gamme: 'Soja Tanty & Farine Composée', cartonsVendus: 1900, partVolume: 19, chiffreAffaires: 7600000, ruptureLineairePct: 1.8 },
    { gamme: 'Spécialités Traditionnelles & Snacks', cartonsVendus: 1100, partVolume: 11, chiffreAffaires: 3000000, ruptureLineairePct: 4.2 }
  ]);

  totalCaRegions = () => this.regions().reduce((a, b) => a + b.caMensuel, 0);
  totalPdVActifs = () => this.regions().reduce((a, b) => a + b.pointsDeVenteActifs, 0);

  ngOnInit(): void {}
}

