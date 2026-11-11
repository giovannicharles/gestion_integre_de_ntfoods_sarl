import { Injectable, signal, computed } from '@angular/core';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    handler: () => void;
  };
}

export interface ActionHistoryItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const SESSION_HISTORY_KEY = 'tanty_action_history_v1';

/**
 * Service de notification toast, affiche des messages flottants non bloquants
 * et conserve l'historique des actions exécutées dans la session pour le Centre de Notifications.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private readonly _history = signal<ActionHistoryItem[]>(this.loadHistory());
  readonly history = this._history.asReadonly();
  readonly unreadHistoryCount = computed(() => this._history().filter((h) => !h.read).length);

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private loadHistory(): ActionHistoryItem[] {
    try {
      const raw = sessionStorage.getItem(SESSION_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveHistory(items: ActionHistoryItem[]): void {
    try {
      sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(items.slice(0, 40)));
    } catch {
      // ignore storage quota errors
    }
  }

  /**
   * Ajoute un toast de succès (vert).
   * Durée par défaut: 4000ms.
   */
  success(message: string, title?: string, duration = 4000): void {
    this.add({ type: 'success', message, title: title || 'Action effectuée', duration });
  }

  /**
   * Ajoute un toast d'erreur (rouge).
   * Durée par défaut: 6000ms (plus long pour permettre la lecture).
   */
  error(message: string, title?: string, duration = 6000): void {
    this.add({ type: 'error', message, title: title || 'Erreur opération', duration });
  }

  /**
   * Ajoute un toast d'avertissement (orange).
   * Durée par défaut: 5000ms.
   */
  warning(message: string, title?: string, duration = 5000): void {
    this.add({ type: 'warning', message, title: title || 'Attention requise', duration });
  }

  /**
   * Ajoute un toast d'information (bleu/vert).
   * Durée par défaut: 4000ms.
   */
  info(message: string, title?: string, duration = 4000): void {
    this.add({ type: 'info', message, title: title || 'Information', duration });
  }

  /**
   * Ajoute un toast avec une action personnalisée (bouton).
   * Le toast ne disparaît pas automatiquement si une action est fournie.
   */
  withAction(
    message: string,
    actionLabel: string,
    actionHandler: () => void,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    title?: string
  ): void {
    this.add({
      type,
      message,
      title: title || 'Action requise',
      duration: undefined,
      action: { label: actionLabel, handler: actionHandler }
    });
  }

  /**
   * Supprime un toast par son ID.
   */
  remove(id: string): void {
    this._toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  /**
   * Supprime tous les toasts flottants.
   */
  clear(): void {
    this._toasts.set([]);
  }

  markHistoryRead(id: string): void {
    this._history.update((list) => {
      const updated = list.map((item) => (item.id === id ? { ...item, read: true } : item));
      this.saveHistory(updated);
      return updated;
    });
  }

  markAllHistoryRead(): void {
    this._history.update((list) => {
      const updated = list.map((item) => ({ ...item, read: true }));
      this.saveHistory(updated);
      return updated;
    });
  }

  clearHistory(): void {
    this._history.set([]);
    this.saveHistory([]);
  }

  private add(toast: Omit<ToastMessage, 'id'>): void {
    const id = this.generateId();
    this._toasts.update((toasts) => [...toasts, { ...toast, id }]);

    // Enregistrer dans le journal d'activité de session
    const historyItem: ActionHistoryItem = {
      id,
      type: toast.type,
      title: toast.title || 'Notification',
      message: toast.message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this._history.update((prev) => {
      const next = [historyItem, ...prev].slice(0, 40);
      this.saveHistory(next);
      return next;
    });

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.remove(id), toast.duration);
    }
  }
}
