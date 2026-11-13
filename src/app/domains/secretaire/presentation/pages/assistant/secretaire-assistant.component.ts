import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-secretaire-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './secretaire-assistant.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecretaireAssistantComponent {
  fCFA = fCFA;

  montantNumerique = signal<number>(850_000);
  beneficiaire = signal('SARL ÉPICERIE CENTRALE');
  motif = signal('Règlement facture n° FAC-2026-089');

  // Convertisseur simplifié en lettres
  get montantEnLettres(): string {
    const m = this.montantNumerique();
    if (m <= 0) return 'Zéro franc CFA';
    return this.nombreEnLettres(m) + ' Francs CFA';
  }

  private nombreEnLettres(n: number): string {
    const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const dizaines = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

    if (n === 1000) return 'mille';
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const reste = n % 100;
      let res = '';
      if (c === 1) res = 'cent';
      else if (c > 1) res = unites[c] + ' cents';

      if (reste > 0) {
        if (res) res += ' ';
        if (reste < 10) res += unites[reste];
        else if (reste <= 19) {
          const spec: Record<number, string> = { 10: 'dix', 11: 'onze', 12: 'douze', 13: 'treize', 14: 'quatorze', 15: 'quinze', 16: 'seize', 17: 'dix-sept', 18: 'dix-huit', 19: 'dix-neuf' };
          res += spec[reste] || '';
        } else {
          const d = Math.floor(reste / 10);
          const u = reste % 10;
          res += dizaines[d] + (u === 1 ? ' et un' : (u > 1 ? '-' + unites[u] : ''));
        }
      }
      return res;
    }

    if (n < 1_000_000) {
      const milliers = Math.floor(n / 1000);
      const reste = n % 1000;
      let res = (milliers === 1 ? 'mille' : this.nombreEnLettres(milliers) + ' mille');
      if (reste > 0) res += ' ' + this.nombreEnLettres(reste);
      return res;
    }

    const millions = Math.floor(n / 1_000_000);
    const reste = n % 1_000_000;
    let res = (millions === 1 ? 'un million' : this.nombreEnLettres(millions) + ' millions');
    if (reste > 0) res += ' ' + this.nombreEnLettres(reste);
    return res;
  }
}
