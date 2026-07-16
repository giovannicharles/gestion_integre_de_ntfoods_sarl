import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
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
  createdAt: string;
  readAt: string | null;
  sentAt: string | null;
  status: string;
  metadata: string | null;
}

interface NotificationUI {
  id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: string;
  priority: string;
}

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

  get unreadCount(): number {
    return this.notifications().filter(n => !n.read).length;
  }

  ngOnInit(): void {
    this.loadNotifications();
  }

  private loadNotifications(): void {
    this.loading.set(true);
    const user = this.auth.getCurrentUser();
    const recipientId = user?.matricule || 'system';
    this.api.get<NotificationBE[]>(`stock/notifications/user/${recipientId}`).pipe(takeUntil(this.d$)).subscribe({
      next: (data) => {
        this.notifications.set((data || []).map(n => this.mapNotification(n)));
        this.loading.set(false);
      },
      error: () => {
        this.notifications.set([]);
        this.loading.set(false);
      }
    });
  }

  private mapNotification(n: NotificationBE): NotificationUI {
    const priority = (n.priority || '').toUpperCase();
    const status = (n.status || '').toUpperCase();
    const type = this.inferType(priority, status, n.title || '');
    return {
      id: n.id,
      type,
      title: n.title || '',
      message: n.message || '',
      time: this.formatTime(n.createdAt),
      read: status === 'READ' || !!n.readAt,
      icon: this.getIcon(type),
      priority
    };
  }

  private inferType(priority: string, status: string, title: string): 'info' | 'success' | 'warning' | 'error' {
    const t = title.toLowerCase();
    if (t.includes('erreur') || t.includes('échec') || priority === 'URGENT') return 'error';
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

  private formatTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
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
    this.d$.next();
    this.d$.complete();
  }
}
