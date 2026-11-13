import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface MessageComptable {
  expediteur: 'USER' | 'ASSISTANT';
  texte: string;
  heure: string;
  options?: string[];
}

@Component({
  selector: 'app-comptable-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comptable-assistant.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComptableAssistantComponent {
  fCFA = fCFA;

  saisieUtilisateur = signal('');
  messages = signal<MessageComptable[]>([
    {
      expediteur: 'ASSISTANT',
      texte: 'Bonjour Monsieur le Comptable. Je suis votre console d\'assistance financière & fiscale OHADA. Comment puis-je vous assister dans vos imputations, calculs de taxes ou contrôles de décaissements aujourd\'hui ?',
      heure: '08:00',
      options: [
        'Imputation Achats Matières Premières (Manioc, Soja)',
        'Calcul TVA 19.25% & Acompte IS 2.2%',
        'Protocole Décaissement Caisse > 50 000 FCFA',
        'Comptes SYSCOHADA Ventes & Créances Clients'
      ]
    }
  ]);

  // Calculateur Fiscal & Taxes Cameroun
  montantHT = signal(1000000);
  tauxTva = 19.25; // %
  tauxAcompte = signal(2.2); // 2.2% ou 5.5%

  montantTva = () => (this.montantHT() * this.tauxTva) / 100;
  montantAcompte = () => (this.montantHT() * this.tauxAcompte()) / 100;
  totalTTC = () => this.montantHT() + this.montantTva();
  netAPayerFournisseur = () => this.totalTTC() - this.montantAcompte();

  envoyerMessage(): void {
    const txt = this.saisieUtilisateur().trim();
    if (!txt) return;

    const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.messages.update(m => [...m, { expediteur: 'USER', texte: txt, heure }]);
    this.saisieUtilisateur.set('');

    setTimeout(() => {
      let reponse = 'Écriture conforme au Plan Comptable OHADA Révisé. Débit 601100 (Achats stockés de matières premières), Débit 445200 (État, TVA récupérable), Crédit 401100 (Fournisseurs).';
      const low = txt.toLowerCase();

      if (low.includes('tva') || low.includes('taxe') || low.includes('is')) {
        reponse = 'Fiscalité Cameroun : Le taux normal de TVA est de 19.25% (17.5% principal + 10% CAC). L\'acompte d\'impôt sur les sociétés (IS) s\'élève à 2.2% pour le régime du réel (ou 5.5% pour les prestataires simplifiés).';
      } else if (low.includes('50 000') || low.includes('décaissement') || low.includes('caisse')) {
        reponse = 'Règle de Contrôle Interne NTFOODS : Tout décaissement supérieur à 50 000 FCFA requiert obligatoirement le double visa préalable : validation comptable + arbitrage formel du Directeur Général avant tout déboursement physique.';
      } else if (low.includes('vente') || low.includes('client') || low.includes('créance')) {
        reponse = 'Ventes Produits Finis Tanty : Débit 411100 (Clients locaux), Crédit 701100 (Ventes de produits finis - Tapioca/Bouillie), Crédit 443100 (État, TVA facturée).';
      }

      this.messages.update(m => [...m, { expediteur: 'ASSISTANT', texte: reponse, heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    }, 500);
  }

  choisirOption(opt: string): void {
    this.saisieUtilisateur.set(opt);
    this.envoyerMessage();
  }
}

