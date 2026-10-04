import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/http/api.service';
import { ApiResponse } from '../../core/models/api-response.model';
import { extractApiError } from '../../core/http/api-error-parser';
import { ToastService } from '../../core/services/toast.service';
import { NotificationWebSocketService, NotificationTempsReel } from '../../core/services/notification-websocket.service';

export interface NotificationItem {
  id: number;
  typeNotification: string;
  titre: string;
  message: string;
  destinataireRole: string | null;
  matriculeDestinataire: string | null;
  canal: string;
  priorite: string;
  referenceLiee: string | null;
  lu: boolean;
  dateCreation: string;
  dateLecture: string | null;
}

const COULEUR_PRIORITE: Record<string, string> = {
  CRITIQUE: 'prio-critique', HAUTE: 'prio-haute', URGENTE: 'prio-critique',
  MOYENNE: 'prio-moyenne', NORMALE: 'prio-moyenne', BASSE: 'prio-basse', FAIBLE: 'prio-basse',
};

/**
 * Centre de notifications (2026-09-30) — cloche + compteur + panneau, alimenté en temps réel par le WebSocket
 * backend déjà câblé (`NotificationWebSocketService`/`/topic/notifications`) : aucun client Angular ne s'y
 * abonnait avant ce composant (vérifié — voir compte rendu). Historique et « marquer lu » via
 * `HistoriqueNotificationController` (`/api/stock/notifications/historique`), le seul endpoint réel de lecture
 * de notifications trouvé dans le backend.
 */
@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-center.component.html',
  styleUrls: ['./notification-center.component.css'],
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly ws = inject(NotificationWebSocketService);
  private readonly toast = inject(ToastService);

  ouvert = signal(false);
  chargement = signal(false);
  erreur = signal<string | null>(null);
  notifications = signal<NotificationItem[]>([]);
  nonLues = signal(0);

  private desabonner: (() => void) | null = null;

  ngOnInit() {
    this.chargerHistorique();
    this.ws.connecter();
    this.desabonner = this.ws.surNotification((n) => this.surNouvelleNotification(n));
  }

  ngOnDestroy() {
    this.desabonner?.();
  }

  @HostListener('document:click')
  fermerAuClicExterieur() {
    this.ouvert.set(false);
  }

  toggle(event: MouseEvent) {
    event.stopPropagation();
    this.ouvert.update((v) => !v);
    if (this.ouvert()) this.chargerHistorique();
  }

  private chargerHistorique() {
    this.chargement.set(true);
    this.erreur.set(null);
    this.api.get<ApiResponse<NotificationItem[]>>('/stock/notifications/historique').subscribe({
      next: (r) => {
        const items = r.donnees ?? [];
        this.notifications.set(items.slice(0, 30));
        this.nonLues.set(items.filter((n) => !n.lu).length);
        this.chargement.set(false);
      },
      error: (err) => {
        this.erreur.set(extractApiError(err));
        this.chargement.set(false);
      },
    });
  }

  private surNouvelleNotification(n: NotificationTempsReel) {
    this.nonLues.update((v) => v + 1);
    this.notifications.update((items) => [
      {
        id: -Date.now(), // pas encore d'id d'historique connu côté client tant que la liste n'est pas rechargée
        typeNotification: n.typeNotification,
        titre: n.titre,
        message: n.message,
        destinataireRole: n.destinataireRole,
        matriculeDestinataire: n.matriculeDestinataire,
        canal: n.canal,
        priorite: n.priorite,
        referenceLiee: n.referenceLiee,
        lu: false,
        dateCreation: n.dateCreation,
        dateLecture: null,
      },
      ...items,
    ]);
    this.toast.info(n.titre, 'Nouvelle notification');
  }

  marquerLu(item: NotificationItem, event: MouseEvent) {
    event.stopPropagation();
    if (item.lu || item.id < 0) return; // notification pas encore rechargée depuis l'historique : rien à marquer côté serveur
    this.api.patch<ApiResponse<NotificationItem>>(`/stock/notifications/historique/${item.id}/lu`, {}).subscribe({
      next: () => {
        item.lu = true;
        this.notifications.update((items) => [...items]);
        this.nonLues.update((v) => Math.max(0, v - 1));
      },
      error: (err) => this.toast.error(extractApiError(err), 'Impossible de marquer comme lu'),
    });
  }

  toutMarquerLu() {
    const nonLues = this.notifications().filter((n) => !n.lu && n.id > 0);
    if (nonLues.length === 0) return;
    nonLues.forEach((n) => this.marquerLu(n, new MouseEvent('click')));
  }

  classePriorite(priorite: string): string {
    return COULEUR_PRIORITE[priorite?.toUpperCase()] ?? 'prio-moyenne';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('fr-FR');
  }
}
