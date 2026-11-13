import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, PreCommandeBE, ClassementCommercialBE, CommandeDistanceBE, CanalCommande, ClientBE } from '../../../../commercial/infrastructure/commercial.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { CanDirective } from '../../../../../shared/directives/can.directive';

interface LigneUI {
  produitCode: string;
  designation: string;
  quantite: number;
  quantiteValidee: number;
}

interface CommandeTourneeUI {
  id: string;
  commercialId: string;
  commercialName?: string;
  dateCommande: Date;
  statut: string;
  lignes: LigneUI[];
  signatureSecretaire: boolean;
  signatureComptable: boolean;
}

interface ProduitCatalogue {
  code: string;
  designation: string;
  conditionnement: string;
  prixUnitaireHT: number;
  cartonPcs: number;
}

interface LigneFormExpress {
  codeProduit: string;
  designation: string;
  conditionnement: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
}

@Component({
  selector: 'app-secretaire-commandes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, CanDirective],
  templateUrl: './secretaire-commandes.component.html',
  styleUrls: ['./secretaire-commandes.component.css']
})
export class SecretaireCommandesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);
  ongletActif = signal<'TOURNEES' | 'DISTANCE'>('TOURNEES');

  // ── CATALOGUE OFFICIEL PRODUITS FINIS TANTY ──
  catalogueProduits = signal<ProduitCatalogue[]>([
    { code: 'PF-BOUILLIE-SOJA-ARACHIDE-500G', designation: 'Tanty Bouillie Soja Arachide (500g)', conditionnement: 'Carton 24 pcs', prixUnitaireHT: 12500, cartonPcs: 24 },
    { code: 'PF-FARINE-PLANTAIN-1KG', designation: 'Tanty Farine de Plantain Pur (1kg)', conditionnement: 'Carton 12 pcs', prixUnitaireHT: 14400, cartonPcs: 12 },
    { code: 'PF-BOUILLIE-SOJA-NATURE-500G', designation: 'Tanty Bouillie Soja Nature (500g)', conditionnement: 'Carton 24 pcs', prixUnitaireHT: 11000, cartonPcs: 24 },
    { code: 'PF-BOUILLIE-RIZ-SOJA-500G', designation: 'Tanty Bouillie Riz-Soja Complète (500g)', conditionnement: 'Carton 24 pcs', prixUnitaireHT: 12000, cartonPcs: 24 },
    { code: 'PF-PIMENT-TABLE-250G', designation: 'Tanty Piment Doux de Table (250g)', conditionnement: 'Carton 24 pcs', prixUnitaireHT: 15000, cartonPcs: 24 },
    { code: 'PF-TAPIOCA-ENRICHI-1KG', designation: 'Tanty Tapioca Enrichi au Soja (1kg)', conditionnement: 'Carton 12 pcs', prixUnitaireHT: 9500, cartonPcs: 12 }
  ]);

  // ── ONGLET 1 : PRÉCOMMANDES TOURNÉES J+1 ──
  commandesTournees = signal<CommandeTourneeUI[]>([]);
  commerciaux = signal<ClassementCommercialBE[]>([]);
  searchTournee = signal<string>('');
  filtreStatutTournee = signal<string>('TOUS');

  readonly commandesTourneesFiltrees = computed(() => {
    let list = this.commandesTournees();
    const q = this.searchTournee().trim().toLowerCase();
    const st = this.filtreStatutTournee();
    if (q) {
      list = list.filter(c =>
        c.id.toLowerCase().includes(q) ||
        (c.commercialName && c.commercialName.toLowerCase().includes(q)) ||
        c.commercialId.toLowerCase().includes(q)
      );
    }
    if (st !== 'TOUS') {
      list = list.filter(c => c.statut === st);
    }
    return list;
  });

  readonly nbTourneesSoumises = computed(() =>
    this.commandesTournees().filter(c => c.statut === 'SOUMISE').length
  );
  readonly nbTourneesValidees = computed(() =>
    this.commandesTournees().filter(c => c.statut === 'VALIDEE_SECRETAIRE' || c.statut === 'VALIDEE_COMPTABLE').length
  );

  // ── ONGLET 2 : COMMANDES DIRECTES & WHATSAPP ──
  commandesDistance = signal<CommandeDistanceBE[]>([]);
  searchDistance = signal<string>('');
  filtreCanalDistance = signal<string>('TOUS');
  filtreStatutDistance = signal<string>('TOUS');

  readonly commandesDistanceFiltrees = computed(() => {
    let list = this.commandesDistance();
    const q = this.searchDistance().trim().toLowerCase();
    const canal = this.filtreCanalDistance();
    const statut = this.filtreStatutDistance();

    if (q) {
      list = list.filter(c =>
        c.numeroCommande.toLowerCase().includes(q) ||
        c.codeClient.toLowerCase().includes(q) ||
        c.matriculeCommercial.toLowerCase().includes(q)
      );
    }
    if (canal !== 'TOUS') {
      list = list.filter(c => c.canal === canal);
    }
    if (statut !== 'TOUS') {
      list = list.filter(c => c.statut === statut);
    }
    return list;
  });

  readonly nbDistanceRecues = computed(() =>
    this.commandesDistance().filter(c => c.statut === 'RECUE').length
  );
  readonly totalMontantDistance = computed(() =>
    this.commandesDistance().reduce((sum, c) => sum + this.calculerTotalCommandeDistance(c), 0)
  );

  // ── FORMULAIRE EXPRESS COMMANDE DIRECTE / WHATSAPP ──
  showModalNouvelleCommande = signal(false);
  modeClient = signal<'EXISTANT' | 'NOUVEAU'>('EXISTANT');
  clients = signal<ClientBE[]>([]);

  formClientExistant = signal<string>('');
  formNouveauNom = signal<string>('');
  formNouveauTelephone = signal<string>('');
  formNouvelleVille = signal<string>('Douala');
  formNouveauQuartier = signal<string>('');
  formCanal = signal<CanalCommande>('WHATSAPP');
  formCommercial = signal<string>('');
  formObservations = signal<string>('');
  formModePaiement = signal<'ESPECES' | 'ORANGE_MONEY' | 'MTN_MOMO' | 'VIREMENT_BANCAIRE' | 'CHEQUE'>('ESPECES');

  lignesCommandeExpress = signal<LigneFormExpress[]>([]);
  savingCommande = signal(false);

  // Totaux financiers réactifs
  readonly totalHTExpress = computed(() =>
    this.lignesCommandeExpress().reduce((sum, l) => sum + (l.quantite * l.prixUnitaire - l.remise), 0)
  );
  readonly tvaExpress = computed(() => Math.round(this.totalHTExpress() * 0.1925));
  readonly totalTTCExpress = computed(() => this.totalHTExpress() + this.tvaExpress());

  // Message WhatsApp formaté en direct
  readonly messageWhatsAppGenere = computed(() => {
    const nomClient = this.modeClient() === 'EXISTANT'
      ? (this.clients().find(c => c.codeClient === this.formClientExistant())?.nom || 'Client TANTY')
      : (this.formNouveauNom() || 'Client TANTY');

    const lignes = this.lignesCommandeExpress();
    let resumeArticles = '';
    lignes.forEach((l, idx) => {
      const sousTotal = (l.quantite * l.prixUnitaire) - l.remise;
      resumeArticles += `• *${l.quantite}x* ${l.designation} (${l.conditionnement}) : ${this.fCFA(sousTotal)}\n`;
    });

    const ref = 'CMD-WA-' + new Date().getTime().toString().slice(-6);

    return `*NTFOODS SARL - TANTY*\n` +
      `Bonjour *${nomClient}*,\n` +
      `Nous accusons réception de votre commande directe :\n\n` +
      `*Réf Pro-Forma :* ${ref}\n` +
      `*Date :* ${new Date().toLocaleDateString('fr-FR')}\n\n` +
      `*Détails des articles :*\n${resumeArticles || '• (Aucun article sélectionné)\n'}\n` +
      `*Total Hors Taxes :* ${this.fCFA(this.totalHTExpress())}\n` +
      `*TVA (19.25%) :* ${this.fCFA(this.tvaExpress())}\n` +
      `*NET À PAYER (TTC) : ${this.fCFA(this.totalTTCExpress())}*\n\n` +
      `*Mode de règlement :* ${this.formModePaiement()}\n` +
      `*Délai de livraison :* 24h ouvrées (Douala / Yaoundé)\n\n` +
      `Merci pour votre confiance en nos produits du terroir camerounais !`;
  });

  // Modal d'impression officielle Devis / Bon de commande
  commandeAImprimer = signal<{
    numero: string;
    clientNom: string;
    clientContact?: string;
    clientVille?: string;
    date: Date;
    canal: string;
    modePaiement: string;
    lignes: { designation: string; conditionnement: string; quantite: number; puHT: number; totalHT: number }[];
    totalHT: number;
    tva: number;
    totalTTC: number;
  } | null>(null);

  // Modal d'impression Bon de chargement camion J+1
  bonChargementAImprimer = signal<CommandeTourneeUI | null>(null);

  // Modal de rejet
  showModalRejet = signal(false);
  commandeARejeter = signal<CommandeDistanceBE | null>(null);
  motifRejet = signal<string>('');
  savingRejet = signal(false);

  ngOnInit(): void {
    this.chargerTout();
  }

  chargerTout(): void {
    this.loading.set(true);

    // 1. Précommandes Tournées J+1
    this.svc.getPrecommandesAValider().subscribe({
      next: page => {
        const mapped = (page.contenu || []).map(pc => this.mapperTournee(pc));
        this.commandesTournees.set(mapped);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    // 2. Commerciaux
    this.svc.getClassementCommerciaux().subscribe({
      next: list => {
        this.commerciaux.set(list || []);
        this.commandesTournees.update(listCmd =>
          listCmd.map(c => ({
            ...c,
            commercialName: this.getNomCommercial(c.commercialId)
          }))
        );
      },
      error: () => {}
    });

    // 3. Commandes Directes / Distance (WhatsApp, Téléphone)
    this.svc.getCommandesDistance().subscribe({
      next: list => this.commandesDistance.set(list || []),
      error: () => {}
    });

    // 4. Clients
    this.svc.getClients().subscribe({
      next: list => this.clients.set(list || []),
      error: () => {}
    });

    // 5. Charger le catalogue produits de l'ERP
    this.stockRepo.getProducts().subscribe({
      next: prods => {
        const pf = prods.filter(p => p.materialType === 'PRODUIT_FINI' && p.active);
        if (pf.length > 0) {
          this.catalogueProduits.set(pf.map(p => ({
            code: p.sku,
            designation: p.designation || p.sku,
            conditionnement: p.packagingType || 'Carton 24 pcs',
            prixUnitaireHT: p.unitPriceAmount || 12000,
            cartonPcs: 24
          })));
        }
      },
      error: () => {}
    });
  }

  // ── ONGLETS ──
  changerOnglet(tab: 'TOURNEES' | 'DISTANCE'): void {
    this.ongletActif.set(tab);
  }

  // ── VALIDATION SECRÉTAIRE DES PRÉCOMMANDES J+1 ──
  validerPrecommandeSecretaire(id: string): void {
    const matricule = this.auth.user()?.matricule || 'SECRETAIRE';
    this.svc.validerSecretaire(id, matricule).subscribe({
      next: () => {
        this.commandesTournees.update(list =>
          list.map(c => c.id === id ? { ...c, statut: 'VALIDEE_SECRETAIRE', signatureSecretaire: true } : c)
        );
        this.toast.success(`Précommande ${id} validée avec succès par le secrétariat.`);
      },
      error: (err) => this.toast.error(extractApiError(err), 'Validation impossible')
    });
  }

  // ── VALIDATION SECRÉTAIRE DES COMMANDES DISTANCE / WHATSAPP ──
  validerDistanceSecretaire(c: CommandeDistanceBE): void {
    const matricule = this.auth.user()?.matricule || 'SECRETAIRE';
    this.svc.validerCommandeDistanceSecretaire(c.numeroCommande, matricule).subscribe({
      next: updated => {
        this.commandesDistance.update(list =>
          list.map(x => x.numeroCommande === updated.numeroCommande ? updated : x)
        );
        this.toast.success(`Commande ${updated.numeroCommande} validée par la secrétaire, transmise au comptable.`);
      },
      error: err => this.toast.error(extractApiError(err), 'Échec validation')
    });
  }

  ouvrirModalRejet(c: CommandeDistanceBE): void {
    this.commandeARejeter.set(c);
    this.motifRejet.set('');
    this.showModalRejet.set(true);
  }

  confirmerRejet(): void {
    const c = this.commandeARejeter();
    const motif = this.motifRejet().trim();
    if (!c || !motif) return;

    const matricule = this.auth.user()?.matricule || 'SECRETAIRE';
    this.savingRejet.set(true);
    this.svc.rejeterCommandeDistance(c.numeroCommande, matricule, motif).subscribe({
      next: updated => {
        this.savingRejet.set(false);
        this.showModalRejet.set(false);
        this.commandesDistance.update(list =>
          list.map(x => x.numeroCommande === updated.numeroCommande ? updated : x)
        );
        this.toast.warning(`Commande ${c.numeroCommande} rejetée.`);
      },
      error: err => {
        this.savingRejet.set(false);
        this.toast.error(extractApiError(err), 'Échec rejet');
      }
    });
  }

  // ── NOUVELLE COMMANDE DIRECTE / WHATSAPP ──
  ouvrirModalNouvelleCommande(): void {
    this.lignesCommandeExpress.set([
      {
        codeProduit: this.catalogueProduits()[0]?.code || '',
        designation: this.catalogueProduits()[0]?.designation || '',
        conditionnement: this.catalogueProduits()[0]?.conditionnement || 'Carton',
        quantite: 5,
        prixUnitaire: this.catalogueProduits()[0]?.prixUnitaireHT || 12500,
        remise: 0
      }
    ]);
    this.formClientExistant.set(this.clients()[0]?.codeClient || '');
    this.formCanal.set('WHATSAPP');
    this.formCommercial.set(this.commerciaux()[0]?.matricule || '');
    this.formObservations.set('');
    this.showModalNouvelleCommande.set(true);
  }

  ajouterLigneArticle(): void {
    const prod = this.catalogueProduits()[0];
    this.lignesCommandeExpress.update(l => [
      ...l,
      {
        codeProduit: prod?.code || '',
        designation: prod?.designation || '',
        conditionnement: prod?.conditionnement || 'Carton',
        quantite: 1,
        prixUnitaire: prod?.prixUnitaireHT || 12000,
        remise: 0
      }
    ]);
  }

  supprimerLigneArticle(index: number): void {
    this.lignesCommandeExpress.update(l => l.filter((_, idx) => idx !== index));
  }

  onChangementProduit(index: number, codeProduit: string): void {
    const prod = this.catalogueProduits().find(p => p.code === codeProduit);
    if (!prod) return;
    this.lignesCommandeExpress.update(l => l.map((ligne, idx) => {
      if (idx !== index) return ligne;
      return {
        ...ligne,
        codeProduit: prod.code,
        designation: prod.designation,
        conditionnement: prod.conditionnement,
        prixUnitaire: prod.prixUnitaireHT
      };
    }));
  }

  mettreAJourQuantite(index: number, qte: any): void {
    const val = Math.max(1, Number(qte) || 1);
    this.lignesCommandeExpress.update(l => l.map((ligne, idx) => idx === index ? { ...ligne, quantite: val } : ligne));
  }

  mettreAJourPrix(index: number, prix: any): void {
    const val = Math.max(0, Number(prix) || 0);
    this.lignesCommandeExpress.update(l => l.map((ligne, idx) => idx === index ? { ...ligne, prixUnitaire: val } : ligne));
  }

  mettreAJourRemise(index: number, remise: any): void {
    const val = Math.max(0, Number(remise) || 0);
    this.lignesCommandeExpress.update(l => l.map((ligne, idx) => idx === index ? { ...ligne, remise: val } : ligne));
  }

  sauvegarderCommandeExpress(): void {
    const codeClient = this.modeClient() === 'EXISTANT'
      ? this.formClientExistant()
      : (this.formNouveauNom().trim() ? 'CLI-D-' + this.formNouveauNom().slice(0, 4).toUpperCase() : '');

    if (!codeClient) {
      this.toast.error('Veuillez identifier le client destinataire.', 'Client manquant');
      return;
    }

    if (this.lignesCommandeExpress().length === 0) {
      this.toast.error('Veuillez ajouter au moins un produit à la commande.', 'Panier vide');
      return;
    }

    this.savingCommande.set(true);

    const payload = {
      codeClient: codeClient,
      matriculeCommercial: this.formCommercial() || this.auth.user()?.matricule || 'SECRETAIRE',
      canal: this.formCanal(),
      dateCommande: new Date().toISOString().slice(0, 10),
      observations: this.formObservations() || `Mode règlement: ${this.formModePaiement()}`,
      lignes: this.lignesCommandeExpress().map(l => ({
        codeProduit: l.codeProduit,
        designation: l.designation,
        conditionnement: l.conditionnement,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire
      }))
    };

    this.svc.creerCommandeDistance(payload).subscribe({
      next: creee => {
        this.savingCommande.set(false);
        this.showModalNouvelleCommande.set(false);
        this.commandesDistance.update(list => [creee, ...list]);
        this.toast.success(`Commande ${creee.numeroCommande} enregistrée avec succès.`);
      },
      error: err => {
        this.savingCommande.set(false);
        this.toast.error(extractApiError(err), "Échec de l'enregistrement");
      }
    });
  }

  // ── OUVERTURE ET ENVOI WHATSAPP ──
  ouvrirWhatsAppDirect(): void {
    const tel = this.modeClient() === 'NOUVEAU'
      ? this.formNouveauTelephone().replace(/\s+/g, '')
      : (this.clients().find(c => c.codeClient === this.formClientExistant())?.telephone || '').replace(/\s+/g, '');

    const message = encodeURIComponent(this.messageWhatsAppGenere());
    const phoneParam = tel ? `phone=${tel.startsWith('237') ? tel : '237' + tel}&` : '';
    const url = `https://api.whatsapp.com/send?${phoneParam}text=${message}`;
    window.open(url, '_blank');
  }

  copierTexteWhatsApp(): void {
    navigator.clipboard.writeText(this.messageWhatsAppGenere()).then(() => {
      this.toast.success('Texte du message WhatsApp copié dans le presse-papiers.');
    });
  }

  // ── IMPRESSION OFFICIELLE PRO-FORMA / DEVIS ──
  ouvrirImpressionProForma(c: CommandeDistanceBE): void {
    const client = this.clients().find(cli => cli.codeClient === c.codeClient);
    const lignes = c.lignes.map(l => ({
      designation: l.designation || l.codeProduit,
      conditionnement: l.conditionnement || 'Carton',
      quantite: l.quantite,
      puHT: l.prixUnitaire,
      totalHT: l.quantite * l.prixUnitaire
    }));
    const totalHT = lignes.reduce((s, x) => s + x.totalHT, 0);
    const tva = Math.round(totalHT * 0.1925);

    this.commandeAImprimer.set({
      numero: c.numeroCommande,
      clientNom: client?.nom || c.codeClient,
      clientContact: client?.telephone || '+237 6xx xxx xxx',
      clientVille: client?.localite || 'Douala',
      date: new Date(c.dateCommande),
      canal: c.canal,
      modePaiement: 'Au comptant / Mobile Money',
      lignes: lignes,
      totalHT: totalHT,
      tva: tva,
      totalTTC: totalHT + tva
    });
  }

  ouvrirImpressionProFormaDepuisForm(): void {
    const clientNom = this.modeClient() === 'EXISTANT'
      ? (this.clients().find(c => c.codeClient === this.formClientExistant())?.nom || 'Client TANTY')
      : (this.formNouveauNom() || 'Client TANTY');

    const clientContact = this.modeClient() === 'NOUVEAU'
      ? this.formNouveauTelephone()
      : (this.clients().find(c => c.codeClient === this.formClientExistant())?.telephone || '');

    const lignes = this.lignesCommandeExpress().map(l => ({
      designation: l.designation,
      conditionnement: l.conditionnement,
      quantite: l.quantite,
      puHT: l.prixUnitaire,
      totalHT: (l.quantite * l.prixUnitaire) - l.remise
    }));

    this.commandeAImprimer.set({
      numero: 'PRO-WA-' + new Date().getTime().toString().slice(-6),
      clientNom: clientNom,
      clientContact: clientContact,
      clientVille: this.formNouvelleVille(),
      date: new Date(),
      canal: this.formCanal(),
      modePaiement: this.formModePaiement(),
      lignes: lignes,
      totalHT: this.totalHTExpress(),
      tva: this.tvaExpress(),
      totalTTC: this.totalTTCExpress()
    });
  }

  fermerImpression(): void {
    this.commandeAImprimer.set(null);
  }

  lancerImpression(): void {
    window.print();
  }

  // ── IMPRESSION BON DE CHARGEMENT CAMION J+1 ──
  ouvrirImpressionBonChargement(c: CommandeTourneeUI): void {
    this.bonChargementAImprimer.set(c);
  }

  fermerImpressionBonChargement(): void {
    this.bonChargementAImprimer.set(null);
  }

  // ── EXPORTS CSV ──
  exporterCsvTournees(): void {
    const list = this.commandesTourneesFiltrees();
    let csv = 'ID;Commercial;Date;Statut;Nb_Articles;Signature_Secretaire;Signature_Comptable\n';
    list.forEach(c => {
      const qteTot = c.lignes.reduce((s, l) => s + l.quantite, 0);
      csv += `"${c.id}";"${c.commercialName || c.commercialId}";"${new Date(c.dateCommande).toLocaleDateString()}";"${c.statut}";"${qteTot}";"${c.signatureSecretaire ? 'OUI' : 'NON'}";"${c.signatureComptable ? 'OUI' : 'NON'}"\n`;
    });
    this.telechargerCsv(csv, `precommandes_tournees_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  exporterCsvDistance(): void {
    const list = this.commandesDistanceFiltrees();
    let csv = 'Numero;Client;Commercial;Canal;Date;Statut;Montant_TTC\n';
    list.forEach(c => {
      const tot = this.calculerTotalCommandeDistance(c);
      csv += `"${c.numeroCommande}";"${c.codeClient}";"${c.matriculeCommercial}";"${c.canal}";"${c.dateCommande}";"${c.statut}";"${tot}"\n`;
    });
    this.telechargerCsv(csv, `commandes_directes_whatsapp_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  private telechargerCsv(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.info(`Fichier CSV ${filename} exporté.`);
  }

  // ── HELPERS ──
  getNomCommercial(matricule: string): string {
    return this.commerciaux().find(c => c.matricule === matricule)?.nomComplet || matricule;
  }

  getNomClient(codeClient: string): string {
    return this.clients().find(c => c.codeClient === codeClient)?.nom || codeClient;
  }

  calculerTotalCommandeDistance(c: CommandeDistanceBE): number {
    return c.lignes.reduce((s, l) => s + (l.quantite * l.prixUnitaire), 0);
  }

  statutTourneeBadge(s: string): string {
    const map: Record<string, string> = {
      SOUMISE: 'badge bg-orange',
      VALIDEE_SECRETAIRE: 'badge bg-primary',
      VALIDEE_COMPTABLE: 'badge bg-success',
      LIVREE: 'badge bg-success',
      REJETEE: 'badge bg-red'
    };
    return map[s] || 'badge bg-neutral';
  }

  statutDistanceBadge(s: string): string {
    const map: Record<string, string> = {
      RECUE: 'badge bg-orange',
      VALIDEE_SECRETAIRE: 'badge bg-primary',
      VALIDEE_COMPTABLE: 'badge bg-success',
      LIVREE: 'badge bg-success',
      REJETEE: 'badge bg-red',
      ANNULEE: 'badge bg-red'
    };
    return map[s] || 'badge bg-neutral';
  }

  canalIcon(canal: string): string {
    switch (canal) {
      case 'WHATSAPP': return 'fa-brands fa-whatsapp text-whatsapp';
      case 'APPEL_TELEPHONIQUE': return 'fa-solid fa-phone text-primary';
      case 'SMS': return 'fa-solid fa-comment-sms text-info';
      case 'EMAIL': return 'fa-solid fa-envelope text-gold';
      default: return 'fa-solid fa-globe';
    }
  }

  private mapperTournee(pc: PreCommandeBE): CommandeTourneeUI {
    return {
      id: pc.numeroPreCommande,
      commercialId: pc.matriculeCommercial,
      commercialName: this.getNomCommercial(pc.matriculeCommercial),
      dateCommande: new Date(pc.dateSoumission),
      statut: pc.statut,
      lignes: pc.lignes.map(l => ({
        produitCode: l.codeProduit,
        designation: l.codeProduit,
        quantite: l.quantiteDemandee,
        quantiteValidee: l.quantiteDemandee
      })),
      signatureSecretaire: !!pc.matriculeValidateurSecretaire,
      signatureComptable: !!pc.matriculeValidateurComptable
    };
  }
}
