import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CommercialService, CommandeDistanceBE, ClientBE, CanalCommande, LigneCommandeDistanceRequest,
} from '../../domains/commercial/infrastructure/commercial.service';
import { StockApiRepository } from '../../domains/stock/infrastructure/repositories/stock-api.repository';
import { Product } from '../../domains/stock/domain/models/stock.models';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { extractApiError } from '../../core/http/api-error-parser';
import { fCFA } from '../utils/format.utils';

const CANAUX: { value: CanalCommande; label: string; icon: string }[] = [
  { value: 'WHATSAPP', label: 'WhatsApp (+237)', icon: 'fa-brands fa-whatsapp' },
  { value: 'APPEL_TELEPHONIQUE', label: 'Téléphone', icon: 'fa-solid fa-phone' },
  { value: 'SMS', label: 'SMS', icon: 'fa-solid fa-comment-sms' },
  { value: 'EMAIL', label: 'Email', icon: 'fa-solid fa-envelope' },
];

interface LigneFormUI {
  codeProduit: string;
  designation: string;
  conditionnement: string;
  quantite: number;
  prixUnitaire: number;
}

@Component({
  selector: 'app-commande-client',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './commande-client.component.html',
  styleUrls: ['./commande-client.component.css']
})
export class CommandeClientComponent implements OnInit {
  private readonly svc = inject(CommercialService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = fCFA;
  canaux = CANAUX;
  Math = Math;

  loading = signal(true);
  loadError = signal<string | null>(null);
  commandes = signal<CommandeDistanceBE[]>([]);
  clients = signal<ClientBE[]>([]);
  produitsFinis = signal<Product[]>([]);
  filterStatut = signal<'TOUTES' | 'RECUE' | 'VALIDEE_SECRETAIRE' | 'VALIDEE_COMPTABLE' | 'LIVREE'>('TOUTES');
  searchTerm = signal('');

  // ── Rôle courant → quelles actions afficher ──
  peutValiderSecretaire = computed(() => this.auth.hasAnyRole(['SECRETAIRE', 'ADMIN']));
  peutValiderComptable = computed(() => this.auth.hasAnyRole(['COMPTABLE', 'ADMIN']));
  peutGerer = computed(() => this.auth.hasAnyRole(['COMMERCIAL', 'DIRECTEUR_COMMERCIAL', 'DIRECTEUR_GENERAL', 'ADMIN', 'GESTIONNAIRE_STOCK', 'CONTROLEUR_GESTION']));

  liste = computed(() => {
    const f = this.filterStatut();
    const q = this.searchTerm().trim().toLowerCase();
    let res = this.commandes();
    if (f !== 'TOUTES') {
      res = res.filter(c => c.statut === f);
    }
    if (q) {
      res = res.filter(c =>
        c.numeroCommande.toLowerCase().includes(q) ||
        this.clientNom(c.codeClient).toLowerCase().includes(q) ||
        c.codeClient.toLowerCase().includes(q) ||
        (c.observations && c.observations.toLowerCase().includes(q))
      );
    }
    return res;
  });

  nbRecues = computed(() => this.commandes().filter(c => c.statut === 'RECUE').length);
  nbValideesSecretaire = computed(() => this.commandes().filter(c => c.statut === 'VALIDEE_SECRETAIRE').length);
  nbValideesComptable = computed(() => this.commandes().filter(c => c.statut === 'VALIDEE_COMPTABLE').length);
  nbLivrees = computed(() => this.commandes().filter(c => c.statut === 'LIVREE').length);

  showForm = signal(false);
  saving = signal(false);
  matriculeActeur = this.auth.user()?.matricule ?? '';
  form = signal({
    codeClient: '',
    nouveauClientNom: '',
    nouveauClientTel: '',
    canal: 'WHATSAPP' as CanalCommande,
    dateCommande: this.formatDate(new Date()),
    observations: ''
  });
  lignesForm = signal<LigneFormUI[]>([]);

  // Modals & action states
  showRejeter = signal<CommandeDistanceBE | null>(null);
  motifRejet = '';
  showAnnuler = signal<CommandeDistanceBE | null>(null);
  motifAnnulation = '';
  actionEnCours = signal<string | null>(null);

  // Print Proforma modal
  commandeAImprimer = signal<CommandeDistanceBE | null>(null);

  ngOnInit(): void {
    this.charger();
    this.svc.getClients().subscribe({ next: c => this.clients.set(c), error: () => {} });
    this.stockRepo.getProducts().subscribe({
      next: p => this.produitsFinis.set(p.filter(x => x.materialType === 'PRODUIT_FINI' && x.active)),
      error: () => {},
    });
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getCommandesDistance().subscribe({
      next: c => { this.commandes.set(c); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  clientNom(code: string): string {
    return this.clients().find(c => c.codeClient === code)?.nom ?? code;
  }

  clientTel(code: string): string {
    return this.clients().find(c => c.codeClient === code)?.telephone ?? '';
  }

  canalLabel(c: string): string {
    return this.canaux.find(x => x.value === c)?.label ?? c;
  }

  canalIcon(c: string): string {
    return this.canaux.find(x => x.value === c)?.icon ?? 'fa-solid fa-circle-question';
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      RECUE: 'badge bg-orange',
      VALIDEE_SECRETAIRE: 'badge bg-neutral',
      VALIDEE_COMPTABLE: 'badge bg-success',
      LIVREE: 'badge bg-success',
      REJETEE: 'badge bg-red',
      ANNULEE: 'badge bg-red',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      RECUE: 'Reçue (att. secrétariat)',
      VALIDEE_SECRETAIRE: 'Validée secrétariat (att. comptabilité)',
      VALIDEE_COMPTABLE: 'Validée comptable (prête à livrer)',
      LIVREE: 'Livrée & Clôturée',
      REJETEE: 'Rejetée',
      ANNULEE: 'Annulée',
    };
    return map[s] ?? s;
  }

  totalLigne(l: { quantite: number; prixUnitaire: number }): number {
    return l.quantite * l.prixUnitaire;
  }

  totalCommande(c: CommandeDistanceBE): number {
    return c.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
  }

  totalFormHT = computed(() => {
    return this.lignesForm().reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
  });

  totalFormTVA = computed(() => {
    return Math.round(this.totalFormHT() * 0.1925);
  });

  totalFormTTC = computed(() => {
    return this.totalFormHT() + this.totalFormTVA();
  });

  // ── Formulaire Création ──────────────────────────────────────────
  ouvrirForm(): void {
    this.form.set({
      codeClient: '',
      nouveauClientNom: '',
      nouveauClientTel: '',
      canal: 'WHATSAPP',
      dateCommande: this.formatDate(new Date()),
      observations: ''
    });
    this.lignesForm.set([]);
    this.ajouterLigne();
    this.showForm.set(true);
  }

  majChamp<K extends 'codeClient' | 'nouveauClientNom' | 'nouveauClientTel' | 'canal' | 'dateCommande' | 'observations'>(champ: K, valeur: any): void {
    this.form.update(f => ({ ...f, [champ]: valeur }));
  }

  ajouterLigne(): void {
    const premier = this.produitsFinis()[0];
    this.lignesForm.update(l => [...l, {
      codeProduit: premier?.sku ?? '',
      designation: premier?.designation ?? '',
      conditionnement: premier?.packagingType ?? 'UNITE',
      quantite: 1,
      prixUnitaire: premier?.unitPriceAmount ?? 0,
    }]);
  }

  retirerLigne(i: number): void {
    this.lignesForm.update(l => l.filter((_, idx) => idx !== i));
  }

  changerProduitLigne(i: number, sku: string): void {
    const p = this.produitsFinis().find(x => x.sku === sku);
    this.lignesForm.update(l => l.map((ligne, idx) => idx === i ? {
      ...ligne,
      codeProduit: sku,
      designation: p?.designation ?? sku,
      conditionnement: p?.packagingType ?? ligne.conditionnement,
      prixUnitaire: p?.unitPriceAmount ?? ligne.prixUnitaire,
    } : ligne));
  }

  majLigne(i: number, champ: 'quantite' | 'prixUnitaire', valeur: number): void {
    this.lignesForm.update(l => l.map((ligne, idx) => idx === i ? { ...ligne, [champ]: valeur } : ligne));
  }

  formValide(): boolean {
    const f = this.form();
    const hasClient = !!f.codeClient || (!!f.nouveauClientNom.trim() && !!f.nouveauClientTel.trim());
    return hasClient && this.lignesForm().length > 0 && this.lignesForm().every(l => l.quantite > 0 && l.codeProduit);
  }

  enregistrer(): void {
    if (!this.formValide()) {
      this.toast.error('Client et au moins une ligne avec produit et quantité valide sont requis.', 'Formulaire incomplet');
      return;
    }
    const f = this.form();
    const codeClientFinal = f.codeClient || `PROSPECT_${f.nouveauClientTel.replace(/\D/g, '')}`;
    const obsFinal = f.codeClient
      ? f.observations.trim()
      : `[Nouveau prospect WhatsApp: ${f.nouveauClientNom.trim()} - Tél: ${f.nouveauClientTel.trim()}] ${f.observations.trim()}`.trim();

    const lignes: LigneCommandeDistanceRequest[] = this.lignesForm().map(l => ({
      codeProduit: l.codeProduit,
      designation: l.designation,
      conditionnement: l.conditionnement,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
    }));

    this.saving.set(true);
    this.svc.creerCommandeDistance({
      codeClient: codeClientFinal,
      matriculeCommercial: this.matriculeActeur,
      canal: f.canal,
      dateCommande: f.dateCommande,
      observations: obsFinal || undefined,
      lignes,
    }).subscribe({
      next: c => {
        this.saving.set(false);
        this.showForm.set(false);
        this.commandes.update(list => [c, ...list]);
        this.toast.success(`Commande ${c.numeroCommande} enregistrée avec succès.`);
        if (f.canal === 'WHATSAPP') {
          this.partagerWhatsApp(c);
        }
      },
      error: e => {
        this.saving.set(false);
        this.toast.error(extractApiError(e), "Échec de l'enregistrement");
      },
    });
  }

  // ── Actions sur une commande existante ──────────────────────────────
  private remplacer(updated: CommandeDistanceBE): void {
    this.commandes.update(list => list.map(x => x.numeroCommande === updated.numeroCommande ? updated : x));
  }

  validerSecretaire(c: CommandeDistanceBE): void {
    this.actionEnCours.set(c.numeroCommande);
    this.svc.validerCommandeDistanceSecretaire(c.numeroCommande, this.matriculeActeur).subscribe({
      next: u => {
        this.actionEnCours.set(null);
        this.remplacer(u);
        this.toast.success(`${u.numeroCommande} validée par le secrétariat.`);
      },
      error: e => {
        this.actionEnCours.set(null);
        this.toast.error(extractApiError(e), 'Échec de la validation');
      },
    });
  }

  validerComptable(c: CommandeDistanceBE): void {
    this.actionEnCours.set(c.numeroCommande);
    this.svc.validerCommandeDistanceComptable(c.numeroCommande, this.matriculeActeur).subscribe({
      next: u => {
        this.actionEnCours.set(null);
        this.remplacer(u);
        this.toast.success(`${u.numeroCommande} visée par la comptabilité (prête à livrer).`);
      },
      error: e => {
        this.actionEnCours.set(null);
        this.toast.error(extractApiError(e), 'Échec de la validation');
      },
    });
  }

  livrer(c: CommandeDistanceBE): void {
    this.actionEnCours.set(c.numeroCommande);
    this.svc.livrerCommandeDistance(c.numeroCommande).subscribe({
      next: u => {
        this.actionEnCours.set(null);
        this.remplacer(u);
        this.toast.success(`${u.numeroCommande} confirmée livrée.`);
      },
      error: e => {
        this.actionEnCours.set(null);
        this.toast.error(extractApiError(e), 'Échec du marquage livré');
      },
    });
  }

  ouvrirRejeter(c: CommandeDistanceBE): void {
    this.motifRejet = '';
    this.showRejeter.set(c);
  }

  confirmerRejeter(): void {
    const c = this.showRejeter();
    if (!c || !this.motifRejet.trim()) return;
    this.svc.rejeterCommandeDistance(c.numeroCommande, this.matriculeActeur, this.motifRejet.trim()).subscribe({
      next: u => {
        this.remplacer(u);
        this.showRejeter.set(null);
        this.toast.success('Commande rejetée.');
      },
      error: e => this.toast.error(extractApiError(e), 'Échec du rejet'),
    });
  }

  ouvrirAnnuler(c: CommandeDistanceBE): void {
    this.motifAnnulation = '';
    this.showAnnuler.set(c);
  }

  confirmerAnnuler(): void {
    const c = this.showAnnuler();
    if (!c || !this.motifAnnulation.trim()) return;
    this.svc.annulerCommandeDistance(c.numeroCommande, this.motifAnnulation.trim()).subscribe({
      next: u => {
        this.remplacer(u);
        this.showAnnuler.set(null);
        this.toast.success('Commande annulée.');
      },
      error: e => this.toast.error(extractApiError(e), "Échec de l'annulation"),
    });
  }

  peutAnnuler(c: CommandeDistanceBE): boolean {
    return this.peutGerer() && c.statut !== 'LIVREE' && c.statut !== 'ANNULEE' && c.statut !== 'REJETEE';
  }

  // ── Impression Proforma & Partage WhatsApp ──────────────────────
  ouvrirImpression(c: CommandeDistanceBE): void {
    this.commandeAImprimer.set(c);
  }

  fermerImpression(): void {
    this.commandeAImprimer.set(null);
  }

  imprimerDocument(): void {
    window.print();
  }

  genererTexteWhatsApp(c: CommandeDistanceBE): string {
    const lignesTxt = c.lignes.map(l => `▪️ ${l.quantite}x ${l.designation} (${l.conditionnement}) : ${this.fCFA(l.quantite * l.prixUnitaire)}`).join('\n');
    const total = this.totalCommande(c);
    const nom = this.clientNom(c.codeClient);

    return `*NTFOODS SARL - TANTY*\n*DEVIS / COMMANDE CLIENT PROFORMA*\n\n` +
      `📋 *Réf Commande* : ${c.numeroCommande}\n` +
      `👤 *Client* : ${nom}\n` +
      `📅 *Date* : ${c.dateCommande}\n` +
      `📦 *Statut* : ${this.statutLabel(c.statut)}\n\n` +
      `*DÉTAIL DES ARTICLES :*\n${lignesTxt}\n\n` +
      `💵 *TOTAL COMMANDE* : *${this.fCFA(total)}*\n` +
      `📍 *Retrait / Livraison* : Douala Bassa, Cameroun\n` +
      `📞 *Service Client TANTY* : +237 670 00 00 00\n` +
      `Merci pour votre confiance !`;
  }

  partagerWhatsApp(c: CommandeDistanceBE): void {
    const texte = encodeURIComponent(this.genererTexteWhatsApp(c));
    let tel = this.clientTel(c.codeClient).replace(/\D/g, '');
    if (tel.length === 9) tel = '237' + tel;
    const url = tel ? `https://api.whatsapp.com/send?phone=${tel}&text=${texte}` : `https://api.whatsapp.com/send?text=${texte}`;
    window.open(url, '_blank');
  }

  copierTexteWhatsApp(c: CommandeDistanceBE): void {
    const texte = this.genererTexteWhatsApp(c);
    navigator.clipboard.writeText(texte).then(() => {
      this.toast.success('Texte proforma copié dans le presse-papier !');
    });
  }

  // ── Export CSV ──────────────────────────────────────────────────
  exporterCsv(): void {
    const data = this.liste();
    if (data.length === 0) {
      this.toast.info('Aucune commande à exporter.');
      return;
    }
    const headers = ['N° Commande', 'Code Client', 'Nom Client', 'Canal', 'Statut', 'Date', 'Nombre Lignes', 'Total FCFA'];
    const rows = data.map(c => [
      c.numeroCommande,
      c.codeClient,
      `"${this.clientNom(c.codeClient).replace(/"/g, '""')}"`,
      c.canal,
      c.statut,
      c.dateCommande,
      c.lignes.length,
      this.totalCommande(c)
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `commandes_clients_tanty_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    this.toast.success('Export CSV généré.');
  }
}
