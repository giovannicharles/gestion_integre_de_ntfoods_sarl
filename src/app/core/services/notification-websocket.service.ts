import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

export interface NotificationTempsReel {
  typeNotification: string;
  titre: string;
  message: string;
  destinataireRole: string | null;
  matriculeDestinataire: string | null;
  canal: string;
  priorite: string;
  referenceLiee: string | null;
  dateCreation: string;
}

/**
 * Client STOMP/SockJS pour les notifications temps réel (2026-09-30) — le backend diffuse déjà sur
 * `/topic/notifications` (global) et `/topic/notifications/{ROLE}` (par rôle), authentifié au CONNECT
 * (`WebSocketAuthInterceptor`) ; aucun client Angular n'existait pour s'y abonner. `withSockJS()` côté serveur
 * impose un client compatible SockJS, pas un WebSocket natif.
 *
 * Un seul service, partagé par le centre de notifications (cloche) et tout écran qui veut un flux ciblé
 * (ex. alertes stock sur `/topic/alertes`) — pas une connexion par composant.
 */
@Injectable({ providedIn: 'root' })
export class NotificationWebSocketService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private client: Client | null = null;

  readonly connecte = signal(false);
  readonly derniereNotification = signal<NotificationTempsReel | null>(null);

  private abonnesGlobal: ((n: NotificationTempsReel) => void)[] = [];

  /** Se connecte une fois ; sans effet si déjà connecté ou pas de session. */
  connecter(): void {
    if (this.client?.active || !this.auth.getToken()) return;

    const wsUrl = environment.apiUrl.replace(/\/api\/?$/, '') + '/ws';
    this.client = new Client({
      webSocketFactory: () => new SockJS(wsUrl) as any,
      connectHeaders: { Authorization: `Bearer ${this.auth.getToken()}` },
      reconnectDelay: 5000,
      onConnect: () => {
        this.connecte.set(true);
        this.abonnerFluxGlobal();
        const role = this.auth.user()?.role;
        if (role) this.abonnerFluxRole(role);
      },
      onDisconnect: () => this.connecte.set(false),
      onStompError: () => this.connecte.set(false),
      onWebSocketError: () => this.connecte.set(false),
    });
    this.client.activate();
  }

  private abonnerFluxGlobal(): void {
    this.client?.subscribe('/topic/notifications', (msg: IMessage) => this.traiter(msg));
  }

  private abonnerFluxRole(role: string): void {
    this.client?.subscribe(`/topic/notifications/${role}`, (msg: IMessage) => this.traiter(msg));
  }

  /** S'abonne aussi à un flux additionnel (ex. `/topic/alertes`) ; retourne une fonction de désabonnement. */
  abonnerFlux(destination: string, callback: (payload: any) => void): () => void {
    if (!this.client?.active) return () => {};
    const sub = this.client.subscribe(destination, (msg: IMessage) => {
      try { callback(JSON.parse(msg.body)); } catch { /* payload non-JSON ignoré */ }
    });
    return () => sub.unsubscribe();
  }

  /** Notifie tous les abonnés au flux global de notifications (utilisé par la cloche du centre de notifications). */
  surNotification(callback: (n: NotificationTempsReel) => void): () => void {
    this.abonnesGlobal.push(callback);
    return () => { this.abonnesGlobal = this.abonnesGlobal.filter((c) => c !== callback); };
  }

  private traiter(msg: IMessage): void {
    try {
      const notif: NotificationTempsReel = JSON.parse(msg.body);
      this.derniereNotification.set(notif);
      this.abonnesGlobal.forEach((cb) => cb(notif));
    } catch {
      // Message non conforme : ignoré plutôt que de faire planter le flux.
    }
  }

  deconnecter(): void {
    this.client?.deactivate();
    this.client = null;
    this.connecte.set(false);
  }

  ngOnDestroy(): void {
    this.deconnecter();
  }
}
