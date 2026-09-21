import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockService, NiveauStockBE } from '../../../../stock/infrastructure/stock.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-controle-valorisation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './controle-valorisation.component.html',
})
export class ControleValorisationComponent implements OnInit {
  fCFA = fCFA;
  Math = Math;
  private readonly stkSvc = inject(StockService);

  stocks = signal<NiveauStockBE[]>([]);

  total = computed(() => this.stocks().reduce((s, m) => s + m.valeurStock, 0));
  nbProduits = computed(() => this.stocks().length);

  ngOnInit(): void {
    this.stkSvc.getEtatStock().subscribe({
      next: s => this.stocks.set(s),
      error: () => {},
    });
  }
}
