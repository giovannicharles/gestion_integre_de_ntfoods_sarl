import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';

interface Classification {
  id: number;
  brand: string;
  range: string;
  variety: string;
  packaging: string;
  quantityPerCarton: number;
  classificationCode: string;
}

@Component({
  selector: 'app-classification-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './classification-list.component.html',
  styleUrls: ['./classification-list.component.css']
})
export class ClassificationListComponent implements OnInit {
  private readonly api = inject(ApiService);

  classifications = signal<Classification[]>([]);
  brands = signal<string[]>([]);
  ranges = signal<string[]>([]);
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  selectedBrand = '';
  selectedRange = '';
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  showDeleteModal = signal(false);
  deleteTarget = signal<Classification | null>(null);

  newClassification: any = {
    brand: '', range: '', variety: '', packaging: '', packagingDetails: '',
    quantityPerCarton: 1, unitWeight: '', volume: '', cartonsPerAssortiment: 1
  };

  ngOnInit(): void {
    this.loadClassifications();
    this.loadBrands();
  }

  loadClassifications(): void {
    this.loading.set(true);
    this.api.get<Classification[]>('stock/product-classifications').subscribe({
      next: (data) => {
        this.classifications.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur chargement classifications', 'error');
      }
    });
  }

  loadBrands(): void {
    this.api.get<string[]>('stock/product-classifications/brands').subscribe({
      next: (data) => this.brands.set(data || []),
      error: () => this.showToast('Erreur chargement marques', 'error')
    });
  }

  onBrandChange(): void {
    if (this.selectedBrand) {
      this.api.get<string[]>(`stock/product-classifications/brand/${this.selectedBrand}/ranges`).subscribe({
        next: (data) => this.ranges.set(data || []),
        error: () => this.showToast('Erreur chargement gammes', 'error')
      });
    } else {
      this.ranges.set([]);
    }
  }

  onRangeChange(): void {
  }

  filterByBrand(): void {
    if (!this.selectedBrand) {
      this.loadClassifications();
      return;
    }
    this.loading.set(true);
    this.api.get<Classification[]>(`stock/product-classifications/brand/${this.selectedBrand}`).subscribe({
      next: (data) => {
        this.classifications.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur lors du filtrage', 'error');
      }
    });
  }

  toggleForm(): void {
    this.showForm.update(v => !v);
  }

  createClassification(): void {
    if (!this.newClassification.brand) {
      this.showToast('Marque requise', 'error');
      return;
    }
    this.saving.set(true);
    this.api.post('stock/product-classifications', this.newClassification).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.resetForm();
        this.loadClassifications();
        this.showToast('Classification créée avec succès', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Erreur lors de la création', 'error');
      }
    });
  }

  openDeleteModal(item: Classification): void {
    this.deleteTarget.set(item);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const item = this.deleteTarget();
    if (!item) return;
    this.saving.set(true);
    this.api.delete(`stock/product-classifications/${item.id}`).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDeleteModal();
        this.loadClassifications();
        this.showToast('Classification supprimée', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.closeDeleteModal();
        this.showToast('Erreur lors de la suppression', 'error');
      }
    });
  }

  resetForm(): void {
    this.newClassification = {
      brand: '', range: '', variety: '', packaging: '', packagingDetails: '',
      quantityPerCarton: 1, unitWeight: '', volume: '', cartonsPerAssortiment: 1
    };
  }

  get totalClassifications(): number {
    return this.classifications().length;
  }

  get totalBrands(): number {
    return this.brands().length;
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }
}
