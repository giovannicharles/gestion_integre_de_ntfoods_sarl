import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommercialService, FicheSyntheseBE } from '../../../infrastructure/commercial.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface ProduitUI { code: string; designation: string; }

@Component({
  selector: 'app-fiche-synthese',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
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

  loading = signal(true);
  loadError = signal<string | null>(null);
  fiche = signal<FicheSyntheseBE | null>(null);
  produits = signal<ProduitUI[]>([]);

  ngOnInit(): void {
    this.charger();
    this.stockRepo.getProducts().subscribe({
      next: list => this.produits.set(list.map(p => ({ code: p.sku, designation: p.designation ?? p.sku }))),
      error: () => {},
    });
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getFicheSynthese().subscribe({
      next: f => { this.fiche.set(f); this.loading.set(false); },
      error: err => {
        const msg = extractApiError(err, 'Impossible de charger la fiche de synthèse');
        this.loadError.set(msg);
        this.toast.error(msg);
        this.loading.set(false);
      },
    });
  }

  imprimer(): void {
    window.print();
  }

  getProduit(code: string): ProduitUI | undefined {
    return this.produits().find(p => p.code === code);
  }
}
