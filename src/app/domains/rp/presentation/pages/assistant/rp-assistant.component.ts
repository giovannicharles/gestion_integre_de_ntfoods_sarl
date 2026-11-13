import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface MessageChat {
  expediteur: 'USER' | 'ASSISTANT';
  texte: string;
  heure: string;
  options?: string[];
}

@Component({
  selector: 'app-rp-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rp-assistant.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RpAssistantComponent {
  fCFA = fCFA;

  saisieUtilisateur = signal('');
  messages = signal<MessageChat[]>([
    {
      expediteur: 'ASSISTANT',
      texte: 'Bonjour Madame la Chargée des Relations Publiques & Commerciales. Je suis votre console d\'assistance commerciale NTFOODS. Comment puis-je vous aider dans vos négociations et partenariats aujourd\'hui ?',
      heure: '08:00',
      options: [
        'Barème officiel des remises par volume',
        'Argumentaire nutritionnel Tapioca & Bouillie',
        'Conditions de référencement GMS (DOVV / Carrefour)',
        'Calculatrice de marge & devis VIP'
      ]
    }
  ]);

  // Simulateur de devis rapide
  produitChoisi = signal('TAPIOCA_1KG');
  quantiteCartons = signal(100);
  prixCartonBase = 15000; // FCFA

  remiseCalculee = () => {
    const q = this.quantiteCartons();
    if (q >= 500) return 15;
    if (q >= 200) return 10;
    if (q >= 50) return 5;
    return 0;
  };

  totalBrut = () => this.quantiteCartons() * this.prixCartonBase;
  montantRemise = () => (this.totalBrut() * this.remiseCalculee()) / 100;
  totalNet = () => this.totalBrut() - this.montantRemise();

  envoyerMessage(): void {
    const txt = this.saisieUtilisateur().trim();
    if (!txt) return;

    const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.messages.update(m => [...m, { expediteur: 'USER', texte: txt, heure }]);
    this.saisieUtilisateur.set('');

    setTimeout(() => {
      let reponse = 'Information enregistrée. Nos barèmes commerciaux officiels prévoient une livraison franco de port à partir de 50 cartons sur le périmètre urbain de Douala et Yaoundé.';
      const low = txt.toLowerCase();

      if (low.includes('remise') || low.includes('barème')) {
        reponse = 'Barème officiel NTFOODS 2026 : Palier 1 (50-199 cartons) = 5% de remise ; Palier 2 (200-499 cartons) = 10% ; Palier 3 Supermarchés VIP (>=500 cartons) = 15% accordé sur validation.';
      } else if (low.includes('nutrition') || low.includes('argument')) {
        reponse = 'Argumentaire Clé : Le Tapioca Tanty est 100% naturel, sans additifs chimiques, précuit à la vapeur selon le procédé breveté NTFOODS, riche en fer et vitamines, certifié norme ANOR.';
      } else if (low.includes('carrefour') || low.includes('dovv') || low.includes('gms')) {
        reponse = 'Protocole GMS : Délai de règlement négocié à 30 jours fin de mois, reprise des avaries sous 48h, participation aux têtes de gondole financée par le budget RP.';
      }

      this.messages.update(m => [...m, { expediteur: 'ASSISTANT', texte: reponse, heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    }, 500);
  }

  choisirOption(opt: string): void {
    this.saisieUtilisateur.set(opt);
    this.envoyerMessage();
  }
}

