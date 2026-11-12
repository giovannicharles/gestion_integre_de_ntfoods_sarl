import { Component, OnInit, signal, inject, ChangeDetectionStrategy, computed} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface StockLocation {
  id: string;
  type: string;
  name: string;
  description: string;
  assignedUserId?: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-localisation-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './localisation-list.component.html',
  styleUrls: ['./localisation-list.component.css']
})
export class LocalisationListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  locations = signal<StockLocation[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');
  searchQuery = signal('');
  filterType = signal('');

  newLocation: any = { type: 'STOCK_CENTRAL', name: '', description: '' };

  locationTypes = [
    { value: 'STOCK_CENTRAL', label: 'Stock Central' },
    { value: 'STOCK_BUFFER', label: 'Stock Tampon' },
    { value: 'STOCK_MOBILE', label: 'Stock Mobile' },
    { value: 'MAGASIN', label: 'Magasin' }
  ];

  filteredLocations = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const type = this.filterType();
    return this.locations().filter(loc => {
      if (type && loc.type !== type) return false;
      if (!q) return true;
      return (loc.name || '').toLowerCase().includes(q) ||
             (loc.description || '').toLowerCase().includes(q) ||
             (loc.id || '').toLowerCase().includes(q);
    });
  });

  ngOnInit(): void {
    this.loadLocations();
  }

  loadLocations(): void {
    this.loading.set(true);
    this.api.get<StockLocation[]>('stock/locations').subscribe({
      next: (data) => {
        this.locations.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = extractApiError(err) || 'Erreur lors du chargement des localisations';
        this.showToast(msg, 'error');
      }
    });
  }

  toggleForm(): void {
    this.showForm.update(v => !v);
  }

  createLocation(): void {
    if (!this.newLocation.name) {
      this.showToast('Nom requis', 'error');
      return;
    }
    this.saving.set(true);
    this.api.post('stock/locations', {
      type: this.newLocation.type,
      name: this.newLocation.name,
      description: this.newLocation.description
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.newLocation = { type: 'STOCK_CENTRAL', name: '', description: '' };
        this.loadLocations();
        this.showToast('Localisation créée avec succès', 'success');
      },
      error: (err) => {
        this.saving.set(false);
        this.showToast(extractApiError(err) || 'Erreur lors de la création', 'error');
      }
    });
  }

  initializeDefaults(): void {
    this.api.post('stock/locations/initialize', {}).subscribe({
      next: () => {
        this.loadLocations();
        this.showToast('Localisations par défaut initialisées', 'success');
      },
      error: (err) => this.showToast(extractApiError(err) || 'Erreur lors de l\'initialisation', 'error')
    });
  }

  assignCommercial(locationId: string, commercialId: string): void {
    if (!commercialId) return;
    this.api.post(`stock/locations/${locationId}/assign`, { commercialId }).subscribe({
      next: () => {
        this.loadLocations();
        this.showToast('Commercial assigné avec succès', 'success');
      },
      error: (err) => this.showToast(extractApiError(err) || 'Erreur lors de l\'assignation', 'error')
    });
  }

  exportLocationsCsv(): void {
    const list = this.filteredLocations();
    if (list.length === 0) {
      this.toast.warning('Aucune localisation à exporter.', 'Export CSV');
      return;
    }
    const headers = ['ID', 'Nom', 'Type', 'Description', 'Assigné à'];
    const rows = list.map(l => [
      `"${l.id || ''}"`,
      `"${l.name || ''}"`,
      `"${this.getTypeLabel(l.type)}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${l.assignedUserId || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `localisations_stock_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.success(`${list.length} localisation(s) exportée(s) en CSV.`, 'Export CSV');
  }

  getTypeLabel(type: string): string {
    const found = this.locationTypes.find(t => t.value === type);
    return found ? found.label : type;
  }

  getTypeClass(type: string): string {
    const m: Record<string, string> = {
      STOCK_CENTRAL: 'badge-central',
      STOCK_BUFFER: 'badge-buffer',
      STOCK_MOBILE: 'badge-mobile',
      MAGASIN: 'badge-magasin'
    };
    return m[type] || 'badge-neutral';
  }

  get centralCount(): number { return this.locations().filter(l => l.type === 'STOCK_CENTRAL').length; }
  get bufferCount(): number { return this.locations().filter(l => l.type === 'STOCK_BUFFER').length; }
  get mobileCount(): number { return this.locations().filter(l => l.type === 'STOCK_MOBILE').length; }
  get magasinCount(): number { return this.locations().filter(l => l.type === 'MAGASIN').length; }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    if (type === 'success') {
      this.toast.success(msg, 'Localisations');
    } else {
      this.toast.error(msg, 'Localisations');
    }
    setTimeout(() => this.toastMsg.set(''), 4000);
  }
}
