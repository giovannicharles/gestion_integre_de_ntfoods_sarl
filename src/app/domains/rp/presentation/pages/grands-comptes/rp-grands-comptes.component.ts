import { Component, ChangeDetectionStrategy, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RpService, GrandCompteResponse } from '../../../infrastructure/rp.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { CanDirective } from '../../../../../shared/directives/can.directive';

type GrandCompteForm = {
  nom: string; type: string; contact: string; telephone: string;
  caMensuel: number; derniereCommande: string; prochaineRelance: string; statut: string;
};

const FORM_VIDE: GrandCompteForm = {
  nom: '', type: 'GMS', contact: '', telephone: '',
  caMensuel: 0, derniereCommande: '', prochaineRelance: '', statut: 'ACTIF',
};

@Component({
  selector: 'app-rp-grands-comptes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, CanDirective],
  templateUrl: './rp-grands-comptes.component.html',
  styleUrls: ['./rp-grands-comptes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RpGrandsComptesComponent implements OnInit {
  fCFA = fCFA;
  private readonly rpSvc = inject(RpService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  saving = signal(false);
  comptes = signal<GrandCompteResponse[]>([]);

  vueAffichage = signal<'cartes' | 'table'>('cartes');
  searchQuery = signal<string>('');
  filtreType = signal<string>('TOUS');

  comptesFiltres = computed(() => {
    let list = this.comptes();
    const t = this.filtreType();
    const q = this.searchQuery().trim().toLowerCase();

    if (t !== 'TOUS') {
      list = list.filter(c => c.type === t);
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

  relancesDues = computed(() => this.comptes().filter(c =>
    c.prochaineRelance && new Date(c.prochaineRelance) <= new Date()));
  caTotal = computed(() => this.comptes().reduce((s, c) => s + (c.caMensuel ?? 0), 0));

  showForm = signal(false);
  editingId = signal<number | null>(null);
  form = signal<GrandCompteForm>({ ...FORM_VIDE });

  actualiserChamp<K extends keyof GrandCompteForm>(champ: K, valeur: GrandCompteForm[K]): void {
    this.form.update(f => ({ ...f, [champ]: valeur }));
  }

  icon(type: string): string {
    return type === 'HÔTEL' || type === 'HOTEL' ? 'fa-hotel' : type === 'GMS' ? 'fa-cart-shopping' : 'fa-bread-slice';
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.rpSvc.getGrandsComptes().subscribe({
      next: c => { this.comptes.set(c); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  ouvrirCreation(): void {
    this.editingId.set(null);
    this.form.set({ ...FORM_VIDE });
    this.showForm.set(true);
  }

  /** Relance rapide (2026-11-09, proposé et implémenté suite à la demande du porteur) : pré-remplit
   * la prochaine relance à J+30 (cadence standard déjà utilisée implicitement ailleurs dans ce
   * module) et ouvre le formulaire d'édition existant pour confirmation avant envoi - aucune
   * écriture silencieuse, le RP garde la main pour ajuster la date avant de valider. */
  marquerRelance(c: GrandCompteResponse): void {
    this.editingId.set(c.id);
    const dans30Jours = new Date();
    dans30Jours.setDate(dans30Jours.getDate() + 30);
    // derniereCommande n'est volontairement pas modifié ici : une relance n'est pas une commande.
    this.form.set({
      nom: c.nom, type: c.type, contact: c.contact, telephone: c.telephone,
      caMensuel: c.caMensuel,
      derniereCommande: c.derniereCommande ? c.derniereCommande.substring(0, 10) : '',
      prochaineRelance: dans30Jours.toISOString().substring(0, 10),
      statut: c.statut,
    });
    this.showForm.set(true);
  }

  estRelanceDue(c: GrandCompteResponse): boolean {
    return !!c.prochaineRelance && new Date(c.prochaineRelance) <= new Date();
  }

  ouvrirEdition(c: GrandCompteResponse): void {
    this.editingId.set(c.id);
    this.form.set({
      nom: c.nom, type: c.type, contact: c.contact, telephone: c.telephone,
      caMensuel: c.caMensuel,
      derniereCommande: c.derniereCommande ? c.derniereCommande.substring(0, 10) : '',
      prochaineRelance: c.prochaineRelance ? c.prochaineRelance.substring(0, 10) : '',
      statut: c.statut,
    });
    this.showForm.set(true);
  }

  fermerForm(): void {
    if (this.saving()) return;
    this.showForm.set(false);
  }

  enregistrer(): void {
    const f = this.form();
    if (!f.nom.trim()) { this.toast.error('Le nom du grand compte est obligatoire.'); return; }
    this.saving.set(true);
    const payload = {
      nom: f.nom.trim(), type: f.type, contact: f.contact, telephone: f.telephone,
      caMensuel: f.caMensuel || 0,
      derniereCommande: f.derniereCommande || null,
      prochaineRelance: f.prochaineRelance || null,
      statut: f.statut,
    };
    const id = this.editingId();
    const requete = id ? this.rpSvc.modifierGrandCompte(id, payload) : this.rpSvc.creerGrandCompte(payload);
    requete.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.toast.success(id ? 'Grand compte modifié.' : 'Grand compte créé.');
        this.charger();
      },
      error: e => { this.saving.set(false); this.toast.error(extractApiError(e), 'Enregistrement impossible'); },
    });
  }

  archiver(c: GrandCompteResponse): void {
    if (!confirm(`Archiver « ${c.nom} » ? Il n'apparaîtra plus dans cette liste.`)) return;
    this.rpSvc.archiverGrandCompte(c.id).subscribe({
      next: () => { this.toast.success('Grand compte archivé.'); this.charger(); },
      error: e => this.toast.error(extractApiError(e), 'Archivage impossible'),
    });
  }

  exporterCsv(): void {
    const list = this.comptesFiltres();
    if (!list.length) {
      this.toast.info('Aucun grand compte à exporter.');
      return;
    }
    const headers = ['Nom', 'Type', 'Contact', 'Telephone', 'CA Mensuel (FCFA)', 'Derniere Commande', 'Prochaine Relance', 'Statut'];
    const rows = list.map(c => [
      `"${c.nom}"`,
      `"${c.type}"`,
      `"${c.contact || ''}"`,
      `"${c.telephone || ''}"`,
      c.caMensuel || 0,
      `"${c.derniereCommande ? new Date(c.derniereCommande).toLocaleDateString('fr-FR') : ''}"`,
      `"${c.prochaineRelance ? new Date(c.prochaineRelance).toLocaleDateString('fr-FR') : ''}"`,
      `"${c.statut}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portefeuille_grands_comptes_rp_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success(`${list.length} grand(s) compte(s) exporté(s) en CSV.`);
  }

  contacterWhatsApp(c: GrandCompteResponse): void {
    if (!c.telephone) {
      this.toast.warning(`Aucun numéro de téléphone renseigné pour ${c.nom}.`);
      return;
    }
    const cleanNum = c.telephone.replace(/[^0-9]/g, '');
    const num = cleanNum.startsWith('237') ? cleanNum : `237${cleanNum}`;
    const msg = encodeURIComponent(`Bonjour ${c.contact || c.nom}, ici la Direction RP NTFOODS TANTY. Nous prenons de vos nouvelles concernant vos approvisionnements et besoins en produits TANTY.`);
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  }
}
