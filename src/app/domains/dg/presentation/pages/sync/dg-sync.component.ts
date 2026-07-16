import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SyncService, SyncLogBE } from '../../../../sync/infrastructure/sync.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-dg-sync',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './dg-sync.component.html',
  styleUrls: ['./dg-sync.component.css']
})
export class DgSyncComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private svc = inject(SyncService);

  loading = signal(true);
  logs = signal<SyncLogBE[]>([]);
  filtered = signal<SyncLogBE[]>([]);
  filterMatricule = '';
  filterEntityType = '';
  filterResult = '';
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    const params: any = {};
    if (this.filterMatricule) params.matricule = this.filterMatricule;
    if (this.filterEntityType) params.entityType = this.filterEntityType;
    if (this.filterResult) params.result = this.filterResult;
    this.svc.getHistorique(params).pipe(takeUntil(this.d$)).subscribe({
      next: (list: SyncLogBE[]) => { this.logs.set(list); this.filtered.set(list); this.loading.set(false); },
      error: (e: unknown) => { this.loading.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  applyFilters(): void {
    const m = this.filterMatricule.toLowerCase();
    const et = this.filterEntityType.toUpperCase();
    const r = this.filterResult.toUpperCase();
    this.filtered.set(this.logs().filter(l =>
      (!m || l.matriculeCommercial?.toLowerCase().includes(m)) &&
      (!et || l.entityType?.toUpperCase() === et) &&
      (!r || l.result?.toUpperCase() === r)
    ));
  }

  resultClass(r: string): string {
    const map: Record<string, string> = {
      SUCCESS: 'badge bg-success', CONFLICT: 'badge bg-orange', FAILED: 'badge bg-red', PENDING: 'badge bg-neutral',
    };
    return map[r] ?? 'badge bg-neutral';
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy(): void { this.d$.next(); this.d$.complete(); }
}
