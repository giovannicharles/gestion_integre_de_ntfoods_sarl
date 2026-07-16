import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';
import { AuthService } from '../../../../../core/auth/auth.service';

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
  selector: 'app-magasin-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './magasin-list.component.html',
  styleUrls: ['./magasin-list.component.css']
})
export class MagasinListComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  magasins = signal<Magasin[]>([]);
  loading = signal(true);
  error = signal('');
  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  currentUser = computed(() => this.auth.getCurrentUser());
  userMatricule = computed(() => this.currentUser()?.matricule || '');

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
    this.api.get<Magasin[]>('stock/locations/magasins').subscribe({
      next: (data) => {
        this.magasins.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du chargement des magasins');
        this.loading.set(false);
        this.showToast('Erreur lors du chargement des magasins', 'error');
      }
    });
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
