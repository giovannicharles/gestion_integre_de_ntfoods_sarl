import { Injectable, signal, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { StockApiRepository } from '../../domains/stock/infrastructure/repositories/stock-api.repository';
import { AuthService } from '../auth/auth.service';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class AlertBadgeService {
  private repo = inject(StockApiRepository);
  private auth = inject(AuthService);
  private api = inject(ApiService);

  /** Total active alerts (backend StockAlert entities) */
  activeAlertCount = signal(0);
  /** Critical priority alerts count */
  criticalCount = signal(0);
  /** Dashboard stock level alerts (low/critical stock) */
  dashboardAlertCount = signal(0);
  /** Unread notifications count */
  notifCount = signal(0);
  /** Combined total for display */
  totalCount = signal(0);
  /** Loading state */
  loading = signal(false);

  private intervalId: any = null;

  startPolling(intervalMs: number = 30000): void {
    this.refresh();
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.refresh(), intervalMs);
  }

  stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  refresh(): void {
    this.loading.set(true);
    this.repo.getBackendAlerts().pipe(
      catchError(() => of([]))
    ).subscribe(alerts => {
      const active = alerts.filter(a => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED');
      this.activeAlertCount.set(active.length);
      this.criticalCount.set(active.filter(a => a.priority === 'CRITICAL').length);
      this.totalCount.set(active.length);
      this.loading.set(false);
    });

    this.repo.getStockAlerts().pipe(
      catchError(() => of([]))
    ).subscribe(dashboard => {
      this.dashboardAlertCount.set(dashboard.length);
      this.totalCount.update(v => Math.max(v, dashboard.length));
    });

    const user = this.auth.getCurrentUser();
    const matricule = user?.matricule || 'system';
    this.api.get<number>(`stock/notifications/user/${matricule}/pending/count`).pipe(
      catchError(() => of(0))
    ).subscribe(count => {
      this.notifCount.set(count || 0);
    });
  }
}
