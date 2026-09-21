import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CommercialService, ClientBE } from '../../../../commercial/infrastructure/commercial.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-rp-grands-comptes',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './rp-grands-comptes.component.html',
})
export class RpGrandsComptesComponent implements OnInit {
  fCFA = fCFA;
  private readonly comSvc = inject(CommercialService);

  comptes = signal<ClientBE[]>([]);

  relancesDues = computed(() => this.comptes().filter(c => !c.actif));
  caTotal = computed(() => 0); // No caMensuel field in ClientBE

  icon(type: string): string {
    return type === 'HÔTEL' ? 'fa-hotel' : type === 'GMS' ? 'fa-cart-shopping' : 'fa-bread-slice';
  }

  ngOnInit(): void {
    this.comSvc.getClients().subscribe({
      next: c => this.comptes.set(c),
      error: () => {},
    });
  }
}
