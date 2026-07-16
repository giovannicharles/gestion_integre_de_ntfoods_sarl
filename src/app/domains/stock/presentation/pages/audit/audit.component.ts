import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule, DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockAuditLog } from '../../../domain/models/stock.models';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, JsonPipe],
  templateUrl: './audit.component.html',
  styleUrls: ['./audit.component.css']
})
export class AuditComponent implements OnInit, OnDestroy {
  private repo = inject(StockApiRepository);
  private d$ = new Subject<void>();

  logs = signal<StockAuditLog[]>([]);
  loading = signal(true);
  filters = { entityType: '', entityId: '', userMatricule: '', action: '' };

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loading.set(true);
    this.repo.getAuditLogs().pipe(takeUntil(this.d$)).subscribe({
      next: r => { this.logs.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  applyFilters() {
    this.loading.set(true);
    const { entityType, entityId, userMatricule, action } = this.filters;
    let obs = this.repo.getAuditLogs();
    if (entityType && entityId) {
      obs = this.repo.getAuditLogsForEntity(entityType, entityId);
    } else if (entityType) {
      obs = this.repo.getAuditLogsByEntityType(entityType);
    } else if (userMatricule) {
      obs = this.repo.getAuditLogsByUser(userMatricule);
    } else if (action) {
      obs = this.repo.getAuditLogsByAction(action);
    }
    obs.pipe(takeUntil(this.d$)).subscribe({
      next: r => { this.logs.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  resetFilters() {
    this.filters = { entityType: '', entityId: '', userMatricule: '', action: '' };
    this.loadAll();
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
