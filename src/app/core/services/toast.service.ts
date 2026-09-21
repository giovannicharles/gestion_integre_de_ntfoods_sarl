import { Injectable, signal } from '@angular/core';

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

/**
 * Service de notification toast — affiche des messages flottants non bloquants.
 *
 * Les messages sont gérés par un signal réactif ; un composant d'affichage
 * s'abonne à `toasts` pour les présenter dans l'interface.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ajoute un toast de succès (vert).
   * Durée par défaut: 4000ms.
   */
  success(message: string, title?: string, duration = 4000): void {
    this.add({ type: 'success', message, title, duration });
  }

  /**
   * Ajoute un toast d'erreur (rouge).
   * Durée par défaut: 6000ms (plus long pour permettre la lecture).
   */
  error(message: string, title?: string, duration = 6000): void {
    this.add({ type: 'error', message, title, duration });
  }

  /**
   * Ajoute un toast d'avertissement (orange).
   * Durée par défaut: 5000ms.
   */
  warning(message: string, title?: string, duration = 5000): void {
    this.add({ type: 'warning', message, title, duration });
  }

  /**
   * Ajoute un toast d'information (bleu).
   * Durée par défaut: 4000ms.
   */
  info(message: string, title?: string, duration = 4000): void {
    this.add({ type: 'info', message, title, duration });
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
      title,
      duration: undefined, // Pas d'auto-dismiss avec action
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
   * Supprime tous les toasts.
   */
  clear(): void {
    this._toasts.set([]);
  }

  private add(toast: Omit<ToastMessage, 'id'>): void {
    const id = this.generateId();
    this._toasts.update((toasts) => [...toasts, { ...toast, id }]);

    // Auto-dismiss si durée définie
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.remove(id), toast.duration);
    }
  }
}
