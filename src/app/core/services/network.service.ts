import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  /** true si le navigateur détecte une connexion réseau */
  isOnline = signal<boolean>(navigator.onLine);
  /** true si le backend a répondu avec succès lors du dernier appel */
  isApiReachable = signal<boolean>(true);
  /** message courant d'indisponibilité (vide si tout va bien) */
  offlineMessage = signal<string>('');

  constructor() {
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false, 'Connexion internet perdue. Vérifiez votre réseau.'));
  }

  setOnline(online: boolean, message = '') {
    this.isOnline.set(online);
    this.offlineMessage.set(message);
    if (online) {
      this.isApiReachable.set(true);
      this.offlineMessage.set('');
    }
  }

  setApiUnreachable(message = 'Le serveur TANTY ERP est injoignable. Vérifiez qu\'il est démarré.') {
    this.isApiReachable.set(false);
    this.offlineMessage.set(message);
  }

  setApiReachable() {
    this.isApiReachable.set(true);
    this.offlineMessage.set('');
  }
}
