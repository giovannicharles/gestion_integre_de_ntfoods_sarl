import { Component, OnInit, OnDestroy, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, interval } from 'rxjs';
import { ApiService } from '../../../../../core/http/api.service';
import { AuthService } from '../../../../../core/auth/auth.service';

interface NotificationBE {
  id: number;
  type: string;
  channel: string;
  recipientId: string;
  title: string;
  message: string;
  priority: string;
  createdAt: any;
  readAt: string | null;
  sentAt: string | null;
  status: string;
  metadata: string | null;
}

interface NotificationUI {
  id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: string;
  priority: string;
}

const NOTIF_TYPE_LABELS: Record<string, string> = {
  'STOCK_ALERT': 'Alerte Stock',
  'SYSTEM_NOTIFICATION': 'Systeme',
  'RECEPTION_VALIDATION': 'Reception',
  'DOTATION_REQUEST': 'Dotation',
  'LOW_STOCK': 'Stock Bas',
  'CRITICAL_STOCK': 'Stock Critique',
  'BUFFER_INSUFFICIENT': 'Tampon Insuff.',
};

const NOTIF_TYPE_ICONS: Record<string, string> = {
  'STOCK_ALERT': 'fa-warehouse',
  'SYSTEM_NOTIFICATION': 'fa-gear',
  'RECEPTION_VALIDATION': 'fa-truck-ramp-box',
  'DOTATION_REQUEST': 'fa-hand-holding',
  'LOW_STOCK': 'fa-arrow-down',
  'CRITICAL_STOCK': 'fa-circle-exclamation',
  'BUFFER_INSUFFICIENT': 'fa-layer-group',
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly d$ = new Subject<void>();

  notifications = signal<NotificationUI[]>([]);
  loading = signal(true);
  filterType = signal('all');
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');
  lastRefresh = signal<Date | null>(null);
  Math = Math;

  unreadCount = computed(() => this.notifications().filter(n => !n.read).length);
  totalCount = computed(() => this.notifications().length);
  warningCount = computed(() => this.notifications().filter(n => n.type === 'warning' && !n.read).length);
  errorCount = computed(() => this.notifications().filter(n => n.type === 'error' && !n.read).length);
  successCount = computed(() => this.notifications().filter(n => n.type === 'success').length);

  private pollTimer: any = null;

  ngOnInit(): void {
    this.loadNotifications();
    this.pollTimer = interval(30000).pipe(takeUntil(this.d$)).subscribe(() => this.loadNotifications(true));
  }

  private loadNotifications(silent: boolean = false): void {
    if (!silent) this.loading.set(true);
    const user = this.auth.getCurrentUser();
    const recipientId = user?.matricule || 'system';
    this.api.get<NotificationBE[]>(`stock/notifications/user/${recipientId}`).pipe(takeUntil(this.d$)).subscribe({
      next: (data) => {
        this.notifications.set((data || []).map(n => this.mapNotification(n)));
        this.lastRefresh.set(new Date());
        this.loading.set(false);
      },
      error: () => {
        if (!silent) this.notifications.set([]);
        this.loading.set(false);
      }
    });
  }

  refresh() {
    this.loadNotifications(false);
  }

  private mapNotification(n: NotificationBE): NotificationUI {
    const priority = (n.priority || '').toUpperCase();
    const status = (n.status || '').toUpperCase();
    const type = this.inferType(priority, status, n.title || '', n.type || '');
    const category = NOTIF_TYPE_LABELS[n.type || ''] || 'Systeme';
    const icon = NOTIF_TYPE_ICONS[n.type || ''] || this.getIcon(type);
    return {
      id: n.id,
      type,
      category,
      title: n.title || '',
      message: n.message || '',
      time: this.formatTime(n.createdAt),
      read: status === 'READ' || !!n.readAt,
      icon,
      priority
    };
  }

  private inferType(priority: string, status: string, title: string, notifType: string): 'info' | 'success' | 'warning' | 'error' {
    const t = title.toLowerCase();
    if (t.includes('erreur') || t.includes('échec') || priority === 'URGENT') return 'error';
    if (notifType === 'STOCK_ALERT' || notifType === 'CRITICAL_STOCK' || notifType === 'BUFFER_INSUFFICIENT') return 'warning';
    if (t.includes('alerte') || t.includes('attente') || priority === 'HIGH') return 'warning';
    if (t.includes('validé') || t.includes('terminé') || t.includes('succès') || status === 'READ') return 'success';
    return 'info';
  }

  private getIcon(type: string): string {
    const m: Record<string, string> = {
      success: 'fa-check-circle',
      warning: 'fa-triangle-exclamation',
      error: 'fa-exclamation-circle',
      info: 'fa-info-circle'
    };
    return m[type] || 'fa-bell';
  }

  private formatTime(raw: any): string {
    if (!raw) return '';
    let d: Date;
    if (Array.isArray(raw)) {
      d = new Date(raw[0], (raw[1] || 1) - 1, raw[2] || 1, raw[3] || 0, raw[4] || 0, raw[5] || 0);
    } else {
      d = new Date(raw);
    }
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 1) return 'À l\'instant';
    if (min < 60) return `Il y a ${min} min`;
    if (hr < 24) return `Il y a ${hr} h`;
    if (day === 1) return 'Hier';
    if (day < 7) return `Il y a ${day} jours`;
    return d.toLocaleDateString('fr-FR');
  }

  markAsRead(notification: NotificationUI): void {
    this.api.post(`stock/notifications/${notification.id}/mark-read`, {}).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => n.id === notification.id ? { ...n, read: true } : n));
        this.showToast('Notification marquée comme lue', 'success');
      },
      error: () => this.showToast('Erreur lors de la mise à jour', 'error')
    });
  }

  markAllAsRead(): void {
    const user = this.auth.getCurrentUser();
    const recipientId = user?.matricule || 'system';
    this.api.post(`stock/notifications/user/${recipientId}/mark-all-read`, {}).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => ({ ...n, read: true })));
        this.showToast('Toutes les notifications marquées comme lues', 'success');
      },
      error: () => this.showToast('Erreur lors de la mise à jour', 'error')
    });
  }

  deleteNotification(id: number): void {
    this.api.delete(`stock/notifications/${id}`).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.notifications.update(list => list.filter(n => n.id !== id));
        this.showToast('Notification supprimée', 'success');
      },
      error: () => this.showToast('Erreur lors de la suppression', 'error')
    });
  }

  getFilteredNotifications(): NotificationUI[] {
    const f = this.filterType();
    if (f === 'all') return this.notifications();
    if (f === 'unread') return this.notifications().filter(n => !n.read);
    return this.notifications().filter(n => n.type === f);
  }

  setFilter(type: string): void {
    this.filterType.set(type);
  }

  getPriorityLabel(p: string): string {
    const m: Record<string, string> = { 'URGENT': 'Urgent', 'HIGH': 'Haute', 'MEDIUM': 'Moyenne', 'LOW': 'Basse' };
    return m[p] || p;
  }

  getPriorityClass(p: string): string {
    if (p === 'URGENT') return 'prio-urgent';
    if (p === 'HIGH') return 'prio-high';
    if (p === 'MEDIUM') return 'prio-medium';
    return 'prio-low';
  }

  getNotificationClass(type: string): string {
    const m: Record<string, string> = { success: 'notif-success', warning: 'notif-warning', error: 'notif-error', info: 'notif-info' };
    return m[type] || 'notif-info';
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.d$.next();
    this.d$.complete();
  }
}
