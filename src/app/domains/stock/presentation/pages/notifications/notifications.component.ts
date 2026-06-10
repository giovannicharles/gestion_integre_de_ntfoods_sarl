import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Notification {
  id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: string;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent {
  notifications: Notification[] = [
    {
      id: 1,
      type: 'warning',
      title: 'Alerte de Stock',
      message: 'Le stock de TBSA est inférieur au seuil de réapprovisionnement',
      time: 'Il y a 5 minutes',
      read: false,
      icon: 'fa-triangle-exclamation'
    },
    {
      id: 2,
      type: 'success',
      title: 'Réception Validée',
      message: 'La réception #REC-2024-001 a été validée avec succès',
      time: 'Il y a 1 heure',
      read: false,
      icon: 'fa-check-circle'
    },
    {
      id: 3,
      type: 'info',
      title: 'Nouvelle Commande',
      message: 'Commande interne #CMD-2024-045 créée pour la production',
      time: 'Il y a 2 heures',
      read: true,
      icon: 'fa-info-circle'
    },
    {
      id: 4,
      type: 'warning',
      title: 'Lot en Attente',
      message: 'Lot de production #LOT-2024-089 en attente de validation',
      time: 'Il y a 3 heures',
      read: true,
      icon: 'fa-clock'
    },
    {
      id: 5,
      type: 'error',
      title: 'Erreur Système',
      message: 'Échec de synchronisation avec le serveur',
      time: 'Hier à 14:30',
      read: true,
      icon: 'fa-exclamation-circle'
    },
    {
      id: 6,
      type: 'success',
      title: 'Inventaire Terminé',
      message: 'Inventaire mensuel terminé avec succès',
      time: 'Hier à 10:00',
      read: true,
      icon: 'fa-check-circle'
    }
  ];

  unreadCount: number = 0;
  filterType: string = 'all';

  constructor() {
    this.updateUnreadCount();
  }

  updateUnreadCount(): void {
    this.unreadCount = this.notifications.filter(n => !n.read).length;
  }

  markAsRead(notification: Notification): void {
    notification.read = true;
    this.updateUnreadCount();
    // TODO: Call API to mark as read
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.updateUnreadCount();
    // TODO: Call API to mark all as read
  }

  deleteNotification(id: number): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.updateUnreadCount();
    // TODO: Call API to delete notification
  }

  getFilteredNotifications(): Notification[] {
    if (this.filterType === 'all') return this.notifications;
    if (this.filterType === 'unread') return this.notifications.filter(n => !n.read);
    return this.notifications.filter(n => n.type === this.filterType);
  }

  setFilter(type: string): void {
    this.filterType = type;
  }

  getNotificationClass(type: string): string {
    switch (type) {
      case 'success': return 'notif-success';
      case 'warning': return 'notif-warning';
      case 'error': return 'notif-error';
      default: return 'notif-info';
    }
  }
}
