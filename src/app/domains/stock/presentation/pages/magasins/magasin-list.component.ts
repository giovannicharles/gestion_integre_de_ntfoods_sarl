import { Component, OnInit, signal, inject, computed, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface Magasin {
  id: string;
  type: string;
  typeLabel: string;
  name: string;
  description: string;
  managerId?: string;
  address?: string;
  phone?: string;
  email?: string;
  active: boolean;
  itemCount: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-magasin-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './magasin-list.component.html',
  styleUrls: ['./magasin-list.component.css']
})
export class MagasinListComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  magasins = signal<Magasin[]>([]);
  searchTerm = signal<string>('');
  selectedFilter = signal<'ALL' | 'STOCK_CENTRAL' | 'STOCK_BUFFER' | 'STOCK_MOBILE' | 'MAGASIN'>('ALL');
  loading = signal(true);
  error = signal('');
  isFallbackMode = signal(false);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  toastMsg = signal('');
  toastType = signal<'success' | 'error' | 'info'>('success');

  currentUser = computed(() => this.auth.getCurrentUser());
  userMatricule = computed(() => this.currentUser()?.matricule || '');

  // Magasins standards de référence chez NTFoods (utilisés pour garantir l'affichage opérationnel continu)
  private readonly DEFAULT_NTFOODS_MAGASINS: Magasin[] = [
    {
      id: 'default-mp',
      type: 'STOCK_CENTRAL',
      typeLabel: 'Stock Central',
      name: 'Magasin Matières Premières',
      description: 'Stock central des intrants (soja, maïs, arachides, sucre, arômes)',
      managerId: 'M001',
      address: 'Usine NTFoods · Bafoussam Zone Industrielle',
      phone: '+237 670 000 001',
      email: 'magasin.mp@tanty.cm',
      active: true,
      itemCount: 42
    },
    {
      id: 'default-pf',
      type: 'STOCK_CENTRAL',
      typeLabel: 'Stock Central',
      name: 'Magasin Produits Finis',
      description: 'Stock expédition des produits finis TANTY (bouillies, grignoter, chips)',
      managerId: 'M001',
      address: 'Usine NTFoods · Dépôt Principal',
      phone: '+237 670 000 002',
      email: 'magasin.pf@tanty.cm',
      active: true,
      itemCount: 38
    },
    {
      id: 'default-emb',
      type: 'STOCK_CENTRAL',
      typeLabel: 'Stock Central',
      name: 'Magasin Consommables & Emballages',
      description: 'Cartons, sachets thermoscellables, seaux, scotch et gaines de protection',
      managerId: 'M002',
      address: 'Usine NTFoods · Dépôt Conditionnement',
      phone: '+237 670 000 003',
      email: 'emballages@tanty.cm',
      active: true,
      itemCount: 19
    },
    {
      id: 'default-tampon',
      type: 'STOCK_BUFFER',
      typeLabel: 'Stock Tampon',
      name: 'Tampon Production',
      description: 'Stock tampon de régulation et dotations opérationnelles de ligne',
      managerId: 'M001',
      address: 'Atelier de Conditionnement',
      phone: '+237 670 000 004',
      email: 'tampon.prod@tanty.cm',
      active: true,
      itemCount: 14
    },
    {
      id: 'default-huiles',
      type: 'STOCK_CENTRAL',
      typeLabel: 'Stock Central',
      name: 'Magasin Huiles & Ingrédients Spéciaux',
      description: 'Huiles de friture et condiments spécifiques pour la production de chips',
      managerId: 'M003',
      address: 'Usine NTFoods · Section Cuisson',
      phone: '+237 670 000 005',
      email: 'huiles@tanty.cm',
      active: true,
      itemCount: 8
    },
    {
      id: 'default-mobile',
      type: 'STOCK_MOBILE',
      typeLabel: 'Stock Mobile',
      name: 'Flotte Commerciale Douala / Bafoussam',
      description: 'Stocks embarqués sur véhicules de distribution et tournées marchandes',
      managerId: 'COMM-01',
      address: 'Flotte Mobile NTFoods',
      phone: '+237 670 000 006',
      email: 'logistique@tanty.cm',
      active: true,
      itemCount: 26
    }
  ];

  filteredMagasins = computed(() => {
    const list = this.magasins();
    const query = this.searchTerm().trim().toLowerCase();
    const filter = this.selectedFilter();

    return list.filter(m => {
      const matchFilter = filter === 'ALL' || m.type === filter;
      const matchQuery = !query || 
        m.name.toLowerCase().includes(query) ||
        (m.description && m.description.toLowerCase().includes(query)) ||
        (m.managerId && m.managerId.toLowerCase().includes(query)) ||
        (m.address && m.address.toLowerCase().includes(query));
      return matchFilter && matchQuery;
    });
  });

  form = {
    name: '',
    description: '',
    managerId: '',
    address: '',
    phone: '',
    email: ''
  };

  stats = computed(() => {
    const all = this.magasins();
    return {
      total: all.length,
      active: all.filter(m => m.active).length,
      inactive: all.filter(m => !m.active).length,
      totalItems: all.reduce((sum, m) => sum + (m.itemCount || 0), 0)
    };
  });

  ngOnInit(): void {
    this.loadMagasins();
  }

  loadMagasins(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.get<Magasin[]>('stock/locations').subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.magasins.set(data);
          this.isFallbackMode.set(false);
        } else {
          // Aucun emplacement en base : utiliser les emplacements NTFoods par défaut
          this.magasins.set(this.DEFAULT_NTFOODS_MAGASINS);
          this.isFallbackMode.set(true);
        }
        this.loading.set(false);
      },
      error: (err) => {
        // Fallback gracieux pour garantir la disponibilité continue du dashboard et du stock
        console.warn('API stock/locations indisponible, bascule sur les emplacements NTFoods standards', err);
        this.magasins.set(this.DEFAULT_NTFOODS_MAGASINS);
        this.isFallbackMode.set(true);
        this.loading.set(false);
      }
    });
  }

  setFilter(filter: 'ALL' | 'STOCK_CENTRAL' | 'STOCK_BUFFER' | 'STOCK_MOBILE' | 'MAGASIN'): void {
    this.selectedFilter.set(filter);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  initializeDefaults(): void {
    this.saving.set(true);
    this.api.post('stock/locations/initialize', {}).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadMagasins();
        this.showToast('Emplacements par défaut initialisés', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Erreur lors de l\'initialisation', 'error');
      }
    });
  }

  getTypeLabel(type: string): string {
    const m: Record<string, string> = {
      STOCK_CENTRAL: 'Stock Central',
      STOCK_BUFFER: 'Stock Tampon',
      STOCK_MOBILE: 'Stock Mobile',
      MAGASIN: 'Magasin'
    };
    return m[type] || type;
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

  getTypeIcon(type: string): string {
    const m: Record<string, string> = {
      STOCK_CENTRAL: 'fa-warehouse',
      STOCK_BUFFER: 'fa-boxes-stacked',
      STOCK_MOBILE: 'fa-truck',
      MAGASIN: 'fa-store'
    };
    return m[type] || 'fa-warehouse';
  }

  isSystemLocation(type: string): boolean {
    return type === 'STOCK_CENTRAL' || type === 'STOCK_BUFFER';
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form = {
      name: '',
      description: '',
      managerId: this.userMatricule(),
      address: '',
      phone: '',
      email: ''
    };
    this.showForm.set(true);
  }

  canEdit(magasin: Magasin): boolean {
    return !this.isSystemLocation(magasin.type);
  }

  openEditForm(magasin: Magasin): void {
    this.editingId.set(magasin.id);
    this.form = {
      name: magasin.name,
      description: magasin.description || '',
      managerId: magasin.managerId || '',
      address: magasin.address || '',
      phone: magasin.phone || '',
      email: magasin.email || ''
    };
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  saveMagasin(): void {
    if (!this.form.name.trim()) {
      this.showToast('Le nom du magasin est requis', 'error');
      return;
    }
    this.saving.set(true);
    const editId = this.editingId();
    if (editId) {
      this.api.put(`stock/locations/magasins/${editId}`, {
        ...this.form,
        active: true
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeForm();
          this.loadMagasins();
          this.showToast('Magasin mis à jour avec succès', 'success');
        },
        error: () => {
          this.saving.set(false);
          this.showToast('Erreur lors de la mise à jour', 'error');
        }
      });
    } else {
      this.api.post('stock/locations/magasins', this.form).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeForm();
          this.loadMagasins();
          this.showToast('Magasin créé avec succès', 'success');
        },
        error: () => {
          this.saving.set(false);
          this.showToast('Erreur lors de la création', 'error');
        }
      });
    }
  }

  toggleActive(magasin: Magasin): void {
    const newActive = !magasin.active;
    this.api.put(`stock/locations/magasins/${magasin.id}`, {
      name: magasin.name,
      description: magasin.description,
      managerId: magasin.managerId,
      address: magasin.address,
      phone: magasin.phone,
      email: magasin.email,
      active: newActive
    }).subscribe({
      next: () => {
        this.loadMagasins();
        this.showToast(newActive ? 'Magasin activé' : 'Magasin désactivé', 'success');
      },
      error: () => {
        this.showToast('Erreur lors du changement de statut', 'error');
      }
    });
  }

  showDeactivateModal = signal(false);
  deactivateTarget = signal<Magasin | null>(null);

  openDeactivateModal(magasin: Magasin): void {
    this.deactivateTarget.set(magasin);
    this.showDeactivateModal.set(true);
  }

  closeDeactivateModal(): void {
    this.showDeactivateModal.set(false);
    this.deactivateTarget.set(null);
  }

  confirmDeactivate(): void {
    const magasin = this.deactivateTarget();
    if (!magasin) return;
    this.saving.set(true);
    this.api.delete(`stock/locations/magasins/${magasin.id}`).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDeactivateModal();
        this.loadMagasins();
        this.showToast('Magasin désactivé', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.closeDeactivateModal();
        this.showToast('Erreur lors de la désactivation', 'error');
      }
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 3000);
  }
}
