import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DgService, ValidationEnAttenteBE } from '../../../infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-dg-arbitrage',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './dg-arbitrage.component.html',
  styleUrls: ['./dg-arbitrage.component.css']
})
export class DgArbitrageComponent implements OnInit {
  today = new Date();
  private readonly dgSvc = inject(DgService);

  validations = signal<ValidationEnAttenteBE[]>([]);
  filterStatut = signal<'all' | 'EN_ATTENTE' | 'APPROUVE' | 'REFUSE'>('all');
  loading = signal(false);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  demandes = computed(() => {
    const f = this.filterStatut();
    return f === 'all' ? this.validations() : this.validations().filter(a => a.type === f);
  });
  nbEnAttente = computed(() => this.validations().filter(a => a.type === 'EN_ATTENTE').length);

  fCFA = fCFA;

  ngOnInit(): void {
    this.dgSvc.getValidationsEnAttente().subscribe({
      next: v => this.validations.set(v),
      error: () => {},
    });
  }

  approuver(ref: string) {
    const item = this.validations().find(a => a.reference === ref);
    if (!item) return;
    this.loading.set(true);
    this.dgSvc.approverValidation(item.type, ref, item.matriculeConcerne || '').subscribe({
      next: () => {
        this.validations.update(list => list.filter(a => a.reference !== ref));
        this.showToast('Demande approuvée avec succès', 'success');
        this.loading.set(false);
      },
      error: () => {
        this.showToast("Erreur lors de l'approbation", 'error');
        this.loading.set(false);
      },
    });
  }

  refuser(ref: string) {
    const item = this.validations().find(a => a.reference === ref);
    if (!item) return;
    this.loading.set(true);
    this.dgSvc.refuserValidation(item.type, ref, item.matriculeConcerne || '').subscribe({
      next: () => {
        this.validations.update(list => list.filter(a => a.reference !== ref));
        this.showToast('Demande refusée', 'success');
        this.loading.set(false);
      },
      error: () => {
        this.showToast('Erreur lors du refus', 'error');
        this.loading.set(false);
      },
    });
  }

  private showToast(msg: string, type: 'success' | 'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 3000);
  }
}
