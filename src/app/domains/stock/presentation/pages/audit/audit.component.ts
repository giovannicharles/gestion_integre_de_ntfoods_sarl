import { Component, OnInit, OnDestroy, signal, inject, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule, DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockAuditLog } from '../../../domain/models/stock.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  /**
   * Pagination serveur (2026-11-02) : la table d'audit est append-only et non bornée, le
   * chargement intégral précédent aurait fini par tout charger en mémoire. Désactivée
   * pendant un filtre (les 4 endpoints filtrés par entité/utilisateur/action restent
   * non paginés : jeux de résultats naturellement petits, scope déjà restreint).
   */
  readonly pageSize = 20;
  page = signal(0);
  totalPages = signal(0);
  totalElements = signal(0);
  filtered = signal(false);

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loading.set(true);
    this.filtered.set(false);
    this.repo.getAuditLogs(this.page(), this.pageSize).pipe(takeUntil(this.d$)).subscribe({
      next: r => {
        this.logs.set(r.contenu);
        this.totalPages.set(r.totalPages);
        this.totalElements.set(r.totalElements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  goToPage(p: number) {
    if (p < 0 || p >= this.totalPages() || p === this.page()) return;
    this.page.set(p);
    this.loadAll();
  }
  prevPage() { this.goToPage(this.page() - 1); }
  nextPage() { this.goToPage(this.page() + 1); }

  applyFilters() {
    this.loading.set(true);
    this.filtered.set(true);
    const { entityType, entityId, userMatricule, action } = this.filters;
    let obs: ReturnType<typeof this.repo.getAuditLogsByAction>;
    if (entityType && entityId) {
      obs = this.repo.getAuditLogsForEntity(entityType, entityId);
    } else if (entityType) {
      obs = this.repo.getAuditLogsByEntityType(entityType);
    } else if (userMatricule) {
      obs = this.repo.getAuditLogsByUser(userMatricule);
    } else if (action) {
      obs = this.repo.getAuditLogsByAction(action);
    } else {
      this.page.set(0);
      this.loadAll();
      return;
    }
    obs.pipe(takeUntil(this.d$)).subscribe({
      next: r => { this.logs.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  resetFilters() {
    this.filters = { entityType: '', entityId: '', userMatricule: '', action: '' };
    this.page.set(0);
    this.loadAll();
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
