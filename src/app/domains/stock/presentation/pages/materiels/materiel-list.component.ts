import { Component, OnInit, signal, inject, OnDestroy, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { Product } from '../../../domain/models';
import { ApiService } from '../../../../../core/http/api.service';

@Component({
  selector: 'app-materiel-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './materiel-list.component.html',
  styleUrls: ['./materiel-list.component.css']
})
export class MaterielListComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private repo = inject(StockApiRepository);
  private api = inject(ApiService);

  loading = signal(true);
  error = signal('');
  materiels = signal<Product[]>([]);
  filtered = signal<Product[]>([]);
  search = '';
  filterActive = '';
  sortBy = signal<'name' | 'sku'>('name');

  pageSize = 10;
  currentPage = signal(1);
  totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize) || 1);
  paginated = signal<Product[]>([]);

  showForm = signal(false);
  saving = signal(false);
  editingId = signal<number | null>(null);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  showDeleteModal = signal(false);
  deleteTarget = signal<Product | null>(null);

  formData: any = {
    sku: '', designation: '', unit: 'unite', packagingType: '',
    quantityPerCarton: 1, unitWeight: '', volume: '', active: true
  };

  Math = Math;

  get pages() {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.repo.getProducts('MATERIEL' as any).pipe(takeUntil(this.d$)).subscribe({
      next: (data) => {
        this.materiels.set(data);
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du chargement des matériels.');
        this.loading.set(false);
      }
    });
  }

  applyFilters() {
    let result = [...this.materiels()];
    if (this.search) {
      const s = this.search.toLowerCase();
      result = result.filter(p =>
        (p.designation || '').toLowerCase().includes(s) ||
        (p.sku || '').toLowerCase().includes(s)
      );
    }
    if (this.filterActive === 'active') {
      result = result.filter(p => p.active !== false);
    } else if (this.filterActive === 'inactive') {
      result = result.filter(p => p.active === false);
    }
    if (this.sortBy() === 'name') {
      result.sort((a, b) => (a.designation || a.sku || '').localeCompare(b.designation || b.sku || ''));
    } else {
      result.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
    }
    this.filtered.set(result);
    this.goToPage(1);
  }

  clearFilters() {
    this.search = '';
    this.filterActive = '';
    this.applyFilters();
  }

  goToPage(p: number) {
    const n = Math.max(1, Math.min(p, this.totalPages()));
    this.currentPage.set(n);
    const s = (n - 1) * this.pageSize;
    this.paginated.set(this.filtered().slice(s, s + this.pageSize));
  }

  getEndIndex(): number {
    return Math.min(this.currentPage() * this.pageSize, this.filtered().length);
  }

  toggleForm() {
    this.showForm.update(v => !v);
    if (!this.showForm()) {
      this.editingId.set(null);
      this.resetForm();
    }
  }

  resetForm() {
    this.formData = {
      sku: '', designation: '', unit: 'unite', packagingType: '',
      quantityPerCarton: 1, unitWeight: '', volume: '', active: true
    };
  }

  openEdit(m: Product) {
    this.editingId.set(m.id);
    this.formData = {
      sku: m.sku || '',
      designation: m.designation || '',
      unit: m.unit || 'unite',
      packagingType: m.packagingType || '',
      quantityPerCarton: m.quantityPerCarton || 1,
      unitWeight: m.unitWeight || '',
      volume: m.volume || '',
      active: m.active !== false
    };
    this.showForm.set(true);
  }

  saveMateriel() {
    if (!this.formData.sku || !this.formData.designation) {
      this.showToast('Code et désignation requis', 'error');
      return;
    }
    this.saving.set(true);
    const payload = {
      ...this.formData,
      materialType: 'MATERIEL',
      unitWeight: this.formData.unitWeight ? Number(this.formData.unitWeight) : undefined,
    };

    const req$ = this.editingId()
      ? this.api.put(`products/${this.editingId()}`, payload)
      : this.api.post('products', payload);

    const wasEditing = !!this.editingId();
    req$.pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.resetForm();
        this.load();
        this.showToast(wasEditing ? 'Matériel mis à jour' : 'Matériel créé', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Erreur lors de l\'enregistrement', 'error');
      }
    });
  }

  openDeleteModal(m: Product) {
    this.deleteTarget.set(m);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete() {
    const m = this.deleteTarget();
    if (!m) return;
    this.saving.set(true);
    this.api.delete(`products/${m.id}`).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDeleteModal();
        this.load();
        this.showToast('Matériel supprimé', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.closeDeleteModal();
        this.showToast('Erreur lors de la suppression', 'error');
      }
    });
  }

  toggleActive(m: Product) {
    this.api.put(`products/${m.id}`, { ...m, active: !m.active }).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.load();
        this.showToast(m.active ? 'Matériel désactivé' : 'Matériel activé', 'success');
      },
      error: () => this.showToast('Erreur lors du changement de statut', 'error')
    });
  }

  get totalActive(): number { return this.materiels().filter(m => m.active !== false).length; }
  get totalInactive(): number { return this.materiels().filter(m => m.active === false).length; }

  private showToast(msg: string, type: 'success' | 'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy() {
    this.d$.next();
    this.d$.complete();
  }
}
