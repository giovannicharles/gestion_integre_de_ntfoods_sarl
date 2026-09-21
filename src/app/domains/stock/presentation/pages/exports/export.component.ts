import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';

interface StockLocation {
  id: string;
  name: string;
  type: string;
}

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export.component.html',
  styleUrls: ['./export.component.css']
})
export class ExportComponent implements OnInit {
  private readonly api = inject(ApiService);

  locations = signal<StockLocation[]>([]);
  selectedLocationId = signal('');
  loading = signal(false);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  ficheLocationType = 'STOCK_CENTRAL';
  fichePeriodStart = '';
  fichePeriodEnd = '';
  ntFoodsMotif = 'Production';
  ntFoodsNom = '';
  ntFoodsVille = '';
  ntFoodsZone = '';
  ntFoodsColis: number | null = null;
  excelLocationType = 'STOCK_CENTRAL';
  excelPeriodStart = '';
  excelPeriodEnd = '';

  ngOnInit(): void {
    this.api.get<StockLocation[]>('stock/locations').subscribe({
      next: (data) => {
        this.locations.set(data || []);
        if (data && data.length > 0) this.selectedLocationId.set(data[0].id);
      },
      error: () => this.showToast('Erreur chargement emplacements', 'error')
    });
  }

  onLocationChange(value: string): void {
    this.selectedLocationId.set(value);
  }

  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  exportItems(format: string): void {
    if (!this.selectedLocationId()) {
      this.showToast('Sélectionnez un emplacement', 'error');
      return;
    }
    this.loading.set(true);
    const locId = this.selectedLocationId();
    this.api.getBlob(`stock/export/items/${locId}/${format}`).subscribe({
      next: (blob: Blob) => {
        this.downloadFile(blob, `stock_items_${locId}.${format === 'excel' ? 'xlsx' : format}`);
        this.loading.set(false);
        this.showToast(`Export ${format.toUpperCase()} réussi`, 'success');
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur lors de l\'export', 'error');
      }
    });
  }

  exportMovements(format: string): void {
    this.loading.set(true);
    this.api.getBlob(`stock/export/movements/${format}`).subscribe({
      next: (blob: Blob) => {
        this.downloadFile(blob, `stock_movements.${format === 'excel' ? 'xlsx' : format}`);
        this.loading.set(false);
        this.showToast(`Export ${format.toUpperCase()} réussi`, 'success');
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur lors de l\'export', 'error');
      }
    });
  }

  downloadFiche(type: string): void {
    this.loading.set(true);
    let url = '';
    const params: Record<string, string> = {};

    if (type === 'stock') {
      url = `stock/export/fiche-synthese/stock/${this.ficheLocationType}`;
    } else {
      const today = new Date().toISOString().split('T')[0];
      const start = this.fichePeriodStart || today;
      const end = this.fichePeriodEnd || today;
      url = `stock/export/fiche-synthese/${type}`;
      params['periodStart'] = start + 'T00:00:00';
      params['periodEnd'] = end + 'T23:59:59';
    }

    this.api.getBlob(url, params).subscribe({
      next: (blob: Blob) => {
        this.downloadFile(blob, `fiche_synthese_${type}.pdf`);
        this.loading.set(false);
        this.showToast('Fiche téléchargée', 'success');
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur lors du téléchargement', 'error');
      }
    });
  }

  downloadNTFoodsFiche(): void {
    this.loading.set(true);
    const params: Record<string, string> = {
      motif: this.ntFoodsMotif
    };
    if (this.ntFoodsNom) params['nom'] = this.ntFoodsNom;
    if (this.ntFoodsVille) params['ville'] = this.ntFoodsVille;
    if (this.ntFoodsZone) params['zone'] = this.ntFoodsZone;
    if (this.ntFoodsColis !== null) params['nombreColis'] = String(this.ntFoodsColis);

    this.api.getBlob('stock/export/fiche-synthese/ntfoods', params).subscribe({
      next: (blob: Blob) => {
        this.downloadFile(blob, `fiche_synthese_tanty_${this.ntFoodsMotif.toLowerCase()}.pdf`);
        this.loading.set(false);
        this.showToast('Fiche NTFoods téléchargée', 'success');
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur lors du téléchargement', 'error');
      }
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  // ── RAPPORTS AVANCÉS (PDF) ──

  reportLocationType = 'STOCK_CENTRAL';
  reportPeriodStart = '';
  reportPeriodEnd = '';

  downloadAdvancedReport(type: string): void {
    this.loading.set(true);
    let url = '';
    let filename = '';
    const params: Record<string, string> = {};
    const today = new Date().toISOString().split('T')[0];
    const start = (this.reportPeriodStart || today) + 'T00:00:00';
    const end = (this.reportPeriodEnd || today) + 'T23:59:59';

    switch (type) {
      case 'valorisation':
        url = `stock/export/valorisation/${this.reportLocationType}`;
        filename = `rapport_valorisation_${this.reportLocationType.toLowerCase()}.pdf`;
        break;
      case 'alertes':
        url = `stock/export/alertes/${this.reportLocationType}`;
        filename = `rapport_alertes_${this.reportLocationType.toLowerCase()}.pdf`;
        break;
      case 'inventaire':
        url = `stock/export/inventaire/${this.reportLocationType}`;
        filename = `inventaire_complet_${this.reportLocationType.toLowerCase()}.pdf`;
        break;
      case 'rotation':
        url = `stock/export/rotation/${this.reportLocationType}`;
        filename = `rapport_rotation_${this.reportLocationType.toLowerCase()}.pdf`;
        params['periodStart'] = start;
        params['periodEnd'] = end;
        break;
      case 'receptions':
        url = `stock/export/receptions`;
        filename = `rapport_receptions.pdf`;
        params['periodStart'] = start;
        params['periodEnd'] = end;
        break;
      case 'dotations':
        url = `stock/export/dotations`;
        filename = `rapport_dotations.pdf`;
        params['periodStart'] = start;
        params['periodEnd'] = end;
        break;
      case 'reappro':
        url = `stock/export/reapprovisionnement`;
        filename = `rapport_reapprovisionnement_tampon.pdf`;
        break;
      case 'transferts':
        url = `stock/export/transferts/${this.reportLocationType}`;
        filename = `rapport_transferts_${this.reportLocationType.toLowerCase()}.pdf`;
        params['periodStart'] = start;
        params['periodEnd'] = end;
        break;
      default:
        return;
    }

    this.api.getBlob(url, params).subscribe({
      next: (blob: Blob) => {
        this.downloadFile(blob, filename);
        this.loading.set(false);
        this.showToast('Rapport téléchargé', 'success');
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur lors du téléchargement', 'error');
      }
    });
  }

  downloadExcelChart(type: string): void {
    this.loading.set(true);
    const locType = this.excelLocationType;
    const today = new Date().toISOString().split('T')[0];
    const start = (this.excelPeriodStart || today) + 'T00:00:00';
    const end = (this.excelPeriodEnd || today) + 'T23:59:59';
    let url = '';
    let filename = '';
    const params: Record<string, string> = {};

    switch (type) {
      case 'items':
        url = `stock/export/excel/items/${locType}`;
        filename = `stock_items_${locType.toLowerCase()}.xlsx`;
        break;
      case 'movements':
        url = `stock/export/excel/movements`;
        filename = `stock_movements.xlsx`;
        break;
      case 'valorisation':
        url = `stock/export/excel/valorisation/${locType}`;
        filename = `valorisation_${locType.toLowerCase()}.xlsx`;
        break;
      case 'global':
        url = `stock/export/excel/global/${locType}`;
        filename = `rapport_global_${locType.toLowerCase()}.xlsx`;
        params['periodStart'] = start;
        params['periodEnd'] = end;
        break;
      default:
        return;
    }

    this.api.getBlob(url, params).subscribe({
      next: (blob: Blob) => {
        this.downloadFile(blob, filename);
        this.loading.set(false);
        this.showToast('Excel avec graphique téléchargé', 'success');
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur lors de l\'export Excel', 'error');
      }
    });
  }
}
