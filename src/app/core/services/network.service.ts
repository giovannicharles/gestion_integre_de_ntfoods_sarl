import { Injectable, signal } from '@angular/core';

/**
 * État de la liaison avec le serveur.
 *
 * Deux choses distinctes y sont suivies : la connexion réseau du poste, que le
 * navigateur signale, et la joignabilité de l'API, que seul un appel réel
 * renseigne. Un poste peut être en ligne et l'API éteinte — c'est même le cas
 * le plus fréquent en développement, et le message doit alors désigner le
 * serveur, pas le réseau.
 *
 * L'intercepteur HTTP alimente le second état à chaque requête.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  /** Vrai si le navigateur détecte une connexion réseau. */
  readonly isOnline = signal<boolean>(navigator.onLine);

  /** Vrai si le backend a répondu lors du dernier appel. */
  readonly isApiReachable = signal<boolean>(true);

  /** Message d'indisponibilité courant. Vide quand tout va bien. */
  readonly offlineMessage = signal<string>('');

  constructor() {
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () =>
      this.setOnline(false, 'Connexion internet perdue. Vérifiez votre réseau.')
    );
  }

  setOnline(online: boolean, message = ''): void {
    this.isOnline.set(online);
    this.offlineMessage.set(message);
    if (online) {
      this.isApiReachable.set(true);
      this.offlineMessage.set('');
    }
  }

  setApiUnreachable(
    message = 'Le serveur TANTY ERP est injoignable. Vérifiez qu\'il est démarré.'
  ): void {
    this.isApiReachable.set(false);
    this.offlineMessage.set(message);
  }

  setApiReachable(): void {
    this.isApiReachable.set(true);
    this.offlineMessage.set('');
  }
}
