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
    this.validations.update(list => list.map(a => a.reference === ref ? { ...a, type: 'APPROUVE' } : a));
  }
  refuser(ref: string) {
    this.validations.update(list => list.map(a => a.reference === ref ? { ...a, type: 'REFUSE' } : a));
  }
}
