import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CommercialService, FicheSyntheseBE } from '../../../infrastructure/commercial.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { ToastService } from '../../../../../core/services/toast.service';

interface ProduitUI { code: string; designation: string; }

@Component({
  selector: 'app-fiche-synthese',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './fiche-synthese.component.html',
  styleUrls: ['./fiche-synthese.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FicheSyntheseComponent implements OnInit {
  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  private readonly svc = inject(CommercialService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly toast = inject(ToastService);

  fiche = signal<FicheSyntheseBE | null>(null);
  produits = signal<ProduitUI[]>([]);

  ngOnInit(): void {
    this.svc.getFicheSynthese().subscribe({
      next: f => this.fiche.set(f),
      error: () => this.toast.error('Impossible de charger la fiche de synthèse'),
    });
    this.stockRepo.getProducts().subscribe(list => {
      this.produits.set(list.map(p => ({ code: p.sku, designation: p.designation ?? p.sku })));
    });
  }

  getProduit(code: string): ProduitUI | undefined {
    return this.produits().find(p => p.code === code);
  }
}
