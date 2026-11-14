import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RpService, GrandCompteResponse } from '../../../infrastructure/rp.service';
import { CommercialService } from '../../../../commercial/infrastructure/commercial.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

export interface InteractionRP {
  id: string;
  compteId: number;
  nomPartenaire: string;
  date: string;
  type: 'VISITE_COURTOISIE' | 'NEGOCIATION_GMS' | 'APPEL_WHATSAPP' | 'RELANCE_COMMANDE' | 'LITIGE_AVARIE' | 'ANIMATION';
  interlocuteur: string;
  canal: 'WHATSAPP' | 'TELEPHONE' | 'PRESENTIEL' | 'EMAIL';
  montantDevisOuCommande?: number;
  statut: 'SUCCES' | 'EN_ATTENTE' | 'A_REVOIR';
  compteRendu: string;
  prochaineAction?: string;
  echeanceProchaineAction?: string;
}

const STORAGE_INTERACTIONS_KEY = 'tanty_rp_interactions_data';

@Component({
  selector: 'app-rp-suivi',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './rp-suivi.component.html',
  styleUrls: ['./rp-suivi.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RpSuiviComponent implements OnInit {
  fCFA = fCFA;
  Math = Math;

  private readonly rpSvc = inject(RpService);
  private readonly commercialSvc = inject(CommercialService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  comptes = signal<GrandCompteResponse[]>([]);
  interactions = signal<InteractionRP[]>([]);

  // Filtres
  filtreTypeCompte = signal<string>('TOUS');
  filtreStatutRelance = signal<'TOUS' | 'A_RELANCER' | 'A_JOUR'>('TOUS');
  rechercheTexte = signal<string>('');
  compteSelectionne = signal<GrandCompteResponse | null>(null);

  // Modal Nouvelle interaction / Compte-rendu
  showModalInteraction = signal(false);
  compteCiblePourInteraction = signal<GrandCompteResponse | null>(null);
  nouvelleInteraction = signal<InteractionRP>({
    id: '',
    compteId: 0,
    nomPartenaire: '',
    date: new Date().toISOString().substring(0, 10),
    type: 'VISITE_COURTOISIE',
    interlocuteur: '',
    canal: 'WHATSAPP',
    statut: 'SUCCES',
    compteRendu: '',
    prochaineAction: '',
    echeanceProchaineAction: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10)
  });

  // KPIs
  totalComptes = computed(() => this.comptes().length);
  totalRelancesDues = computed(() => this.comptes().filter(c => this.estRelanceDue(c)).length);
  totalCaPortefeuille = computed(() => this.comptes().reduce((s, c) => s + (c.caMensuel || 0), 0));

  comptesFiltres = computed(() => {
    let list = this.comptes();
    const type = this.filtreTypeCompte();
    const statut = this.filtreStatutRelance();
    const q = this.rechercheTexte().trim().toLowerCase();

    if (type !== 'TOUS') {
      list = list.filter(c => c.type === type);
    }
    if (statut === 'A_RELANCER') {
      list = list.filter(c => this.estRelanceDue(c));
    } else if (statut === 'A_JOUR') {
      list = list.filter(c => !this.estRelanceDue(c));
    }
    if (q) {
      list = list.filter(c =>
        c.nom.toLowerCase().includes(q) ||
        (c.contact && c.contact.toLowerCase().includes(q)) ||
        (c.telephone && c.telephone.includes(q))
      );
    }
    return list;
  });

  interactionsDuCompte = computed(() => {
    const c = this.compteSelectionne();
    if (!c) return this.interactions();
    return this.interactions().filter(i => i.compteId === c.id);
  });

  ngOnInit(): void {
    this.chargerComptes();
    this.chargerInteractions();
  }

  chargerComptes(): void {
    this.loading.set(true);
    this.rpSvc.getGrandsComptes().subscribe({
      next: res => {
        this.comptes.set(res || []);
        if (res?.length && !this.compteSelectionne()) {
          this.compteSelectionne.set(res[0]);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  chargerInteractions(): void {
    const saved = localStorage.getItem(STORAGE_INTERACTIONS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.interactions.set(parsed);
          return;
        }
      } catch (_) {}
    }
    this.interactions.set([]);
  }

  sauvegarderInteractions(liste: InteractionRP[]): void {
    this.interactions.set(liste);
    localStorage.setItem(STORAGE_INTERACTIONS_KEY, JSON.stringify(liste));
  }

  selectionnerCompte(c: GrandCompteResponse): void {
    this.compteSelectionne.set(c);
  }

  estRelanceDue(c: GrandCompteResponse): boolean {
    if (c.statut === 'A_RELANCER') return true;
    if (!c.prochaineRelance) return false;
    return new Date(c.prochaineRelance) <= new Date();
  }

  contacterWhatsApp(c: GrandCompteResponse, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!c.telephone) {
      this.toast.error('Aucun numéro de téléphone renseigné pour ce compte.');
      return;
    }
    const cleanPhone = c.telephone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('237') ? cleanPhone : `237${cleanPhone}`;
    const text = encodeURIComponent(
      `Bonjour ${c.contact || c.nom},\nDirection RP & Grands Comptes NTFOODS TANTY.\n` +
      `Nous faisons suite à notre partenariat pour votre réapprovisionnement et opérations commerciales.`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  }

  ouvrirModalNouvelleInteraction(c?: GrandCompteResponse, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const cible = c || this.compteSelectionne() || this.comptes()[0];
    if (!cible) {
      this.toast.info('Veuillez sélectionner un compte d\'abord.');
      return;
    }
    this.compteCiblePourInteraction.set(cible);
    this.nouvelleInteraction.set({
      id: 'INT-' + Date.now(),
      compteId: cible.id,
      nomPartenaire: cible.nom,
      date: new Date().toISOString().substring(0, 10),
      type: 'VISITE_COURTOISIE',
      interlocuteur: cible.contact || '',
      canal: 'WHATSAPP',
      statut: 'SUCCES',
      compteRendu: '',
      prochaineAction: 'Relance réapprovisionnement',
      echeanceProchaineAction: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10)
    });
    this.showModalInteraction.set(true);
  }

  fermerModalInteraction(): void {
    this.showModalInteraction.set(false);
  }

  enregistrerInteraction(): void {
    const act = this.nouvelleInteraction();
    if (!act.compteRendu.trim()) {
      this.toast.error('Veuillez saisir un compte-rendu d\'interaction.');
      return;
    }
    const cible = this.compteCiblePourInteraction();
    if (!cible) return;

    act.id = 'INT-' + Date.now();
    act.compteId = cible.id;
    act.nomPartenaire = cible.nom;

    const existantes = this.interactions();
    const maj = [act, ...existantes];
    this.sauvegarderInteractions(maj);

    // Mettre à jour la date de relance du grand compte
    if (act.echeanceProchaineAction) {
      this.rpSvc.modifierGrandCompte(cible.id, {
        nom: cible.nom,
        type: cible.type,
        contact: cible.contact,
        telephone: cible.telephone,
        caMensuel: cible.caMensuel,
        derniereCommande: cible.derniereCommande,
        prochaineRelance: act.echeanceProchaineAction,
        statut: 'ACTIF'
      }).subscribe({
        next: updated => {
          this.comptes.update(list => list.map(item => item.id === updated.id ? updated : item));
          if (this.compteSelectionne()?.id === updated.id) {
            this.compteSelectionne.set(updated);
          }
        },
        error: () => {}
      });
    }

    this.showModalInteraction.set(false);
    this.toast.success(`Compte-rendu d'interaction consigné pour « ${cible.nom} ».`);
  }

  exporterHistoriqueCsv(): void {
    const list = this.interactionsDuCompte();
    if (!list.length) {
      this.toast.info('Aucun historique d\'interaction à exporter.');
      return;
    }
    const headers = ['Date', 'Partenaire', 'Type', 'Canal', 'Interlocuteur', 'Statut', 'Compte-Rendu', 'Prochaine Action', 'Echeance'];
    const rows = list.map(i => [
      `"${i.date}"`,
      `"${i.nomPartenaire}"`,
      `"${i.type}"`,
      `"${i.canal}"`,
      `"${i.interlocuteur}"`,
      `"${i.statut}"`,
      `"${i.compteRendu.replace(/"/g, '""')}"`,
      `"${i.prochaineAction || ''}"`,
      `"${i.echeanceProchaineAction || ''}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `suivi_rp_${this.compteSelectionne()?.nom || 'global'}_${new Date().toISOString().substring(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success('Historique de suivi exporté en CSV.');
  }

  imprimerFicheSuivi(): void {
    window.print();
  }
}
