import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../../core/services/toast.service';

export interface ParametresRP {
  cadenceRelanceJours: number;
  alerteEcheanceJours: number;
  seuilInactiviteCritiqueJours: number;
  remiseMaxSansDgPourcent: number;
  dotationMaxMensuelleFCFA: number;
  notifWhatsAppEnDirect: boolean;
  notifBaisseOccupationZone: boolean;
  modeleMsgReappro: string;
  modeleMsgDegustation: string;
  modeleMsgCourtoisie: string;
}

const STORAGE_KEY = 'tanty_rp_parametres';

const PARAMETRES_DEFAUT: ParametresRP = {
  cadenceRelanceJours: 30,
  alerteEcheanceJours: 3,
  seuilInactiviteCritiqueJours: 60,
  remiseMaxSansDgPourcent: 5,
  dotationMaxMensuelleFCFA: 150000,
  notifWhatsAppEnDirect: true,
  notifBaisseOccupationZone: true,
  modeleMsgReappro: 'Bonjour {contact}, ici NTFOODS TANTY. Vos rayons de produits TANTY nécessitent-ils un réassort cette semaine ? Nos équipes de livraison sont à votre disposition.',
  modeleMsgDegustation: 'Cher partenaire {nom_partenaire}, NTFOODS vous propose une animation dégustation offerte sur vos points de vente pour stimuler la rotation des gammes TANTY.',
  modeleMsgCourtoisie: 'Bonjour {contact}, nous faisons un point de suivi sur nos accords de distribution TANTY. Tout se déroule-t-il selon vos attentes ?'
};

@Component({
  selector: 'app-rp-parametres',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rp-parametres.component.html',
  styleUrls: ['./rp-parametres.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RpParametresComponent implements OnInit {
  private readonly toast = inject(ToastService);

  config = signal<ParametresRP>({ ...PARAMETRES_DEFAUT });
  sauvegardeEnCours = signal(false);
  activeTab = signal<'RELANCES' | 'MESSAGES' | 'REMISES' | 'NOTIFICATIONS'>('RELANCES');

  ngOnInit(): void {
    this.chargerConfig();
  }

  chargerConfig(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.config.set({ ...PARAMETRES_DEFAUT, ...JSON.parse(saved) });
      }
    } catch (_) {
      this.config.set({ ...PARAMETRES_DEFAUT });
    }
  }

  enregistrer(): void {
    this.sauvegardeEnCours.set(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config()));
      setTimeout(() => {
        this.sauvegardeEnCours.set(false);
        this.toast.success('Paramètres du module Relations Publiques enregistrés avec succès.');
      }, 300);
    } catch (e) {
      this.sauvegardeEnCours.set(false);
      this.toast.error('Erreur lors de la sauvegarde des paramètres.');
    }
  }

  reinitialiser(): void {
    if (confirm('Voulez-vous restaurer les paramètres recommandés par défaut ?')) {
      this.config.set({ ...PARAMETRES_DEFAUT });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(PARAMETRES_DEFAUT));
      this.toast.info('Paramètres RP réinitialisés aux valeurs par défaut.');
    }
  }

  mettreAJour<K extends keyof ParametresRP>(cle: K, valeur: ParametresRP[K]): void {
    this.config.update(c => ({ ...c, [cle]: valeur }));
  }
}
