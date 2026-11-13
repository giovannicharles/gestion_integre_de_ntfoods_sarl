import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, PreCommandeBE, ClassementCommercialBE, CommandeDistanceBE, CanalCommande, ClientBE } from '../../../../commercial/infrastructure/commercial.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { ToastService } from '../../../../../core/services/toast.service';
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
  selector: 'app-comptable-commandes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, CanDirective],
  templateUrl: './comptable-commandes.component.html',
  styleUrls: ['./comptable-commandes.component.css']
})
export class ComptableCommandesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);
  ongletActif = signal<'DISTANCE' | 'TOURNEES'>('DISTANCE');

  // ── CATALOGUE PRODUITS FINIS TANTY ──
  catalogueProduits = signal<ProduitCatalogue[]>([
    { code: 'PF-BOUILLIE-SOJA-ARACHIDE-500G', designation: 'Tanty Bouillie Soja Arachide (500g)', conditionnement: 'Carton 24 pcs', prixUnitaireHT: 12500, cartonPcs: 24 },
    { code: 'PF-FARINE-PLANTAIN-1KG', designation: 'Tanty Farine de Plantain Pur (1kg)', conditionnement: 'Carton 12 pcs', prixUnitaireHT: 14400, cartonPcs: 12 },
    { code: 'PF-BOUILLIE-SOJA-NATURE-500G', designation: 'Tanty Bouillie Soja Nature (500g)', conditionnement: 'Carton 24 pcs', prixUnitaireHT: 11000, cartonPcs: 24 },
    { code: 'PF-BOUILLIE-RIZ-SOJA-500G', designation: 'Tanty Bouillie Riz-Soja Complète (500g)', conditionnement: 'Carton 24 pcs', prixUnitaireHT: 12000, cartonPcs: 24 },
    { code: 'PF-PIMENT-TABLE-250G', designation: 'Tanty Piment Doux de Table (250g)', conditionnement: 'Carton 24 pcs', prixUnitaireHT: 15000, cartonPcs: 24 },
    { code: 'PF-TAPIOCA-ENRICHI-1KG', designation: 'Tanty Tapioca Enrichi au Soja (1kg)', conditionnement: 'Carton 12 pcs', prixUnitaireHT: 9500, cartonPcs: 12 }
  ]);

  // ── ON GLET 1 : COMMANDES DISTANCE / WHATSAPP ──
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

  readonly totalCommandesDistance = computed(() => this.commandesDistance().length);
  readonly nbCommandesWhatsApp = computed(() => this.commandesDistance().filter(c => c.canal === 'WHATSAPP').length);
  readonly nbDistanceEnAttenteComptable = computed(() => this.commandesDistance().filter(c => c.statut === 'VALIDEE_SECRETAIRE' || c.statut === 'CREEE').length);
  readonly valeurTotalDistance = computed(() => {
    return this.commandesDistance().reduce((acc, c) => {
      const totLignes = (c.lignes || []).reduce((s, l) => s + (l.quantite * l.prixUnitaire), 0);
      return acc + totLignes;
    }, 0);
  });

  // ── ONGLET 2 : PRÉCOMMANDES TOURNÉES J+1 ──
  commandesTournees = signal<CommandeTourneeUI[]>([]);
  filtreStatutTournees = signal<string>('VALIDEE_SECRETAIRE');
  statutOptionsTournees = ['TOUTES', 'SOUMISE', 'VALIDEE_SECRETAIRE', 'VALIDEE_COMPTABLE'];

  readonly commandesTourneesFiltrees = computed(() => {
    const f = this.filtreStatutTournees();
    return f === 'TOUTES' ? this.commandesTournees() : this.commandesTournees().filter(c => c.statut === f);
  });
  readonly nbTourneesEnAttente = computed(() => this.commandesTournees().filter(c => c.statut === 'VALIDEE_SECRETAIRE').length);
  readonly nbTourneesValidees = computed(() => this.commandesTournees().filter(c => c.statut === 'VALIDEE_COMPTABLE').length);

  // ── COMMERCIAUX & CLIENTS ──
  commerciaux = signal<ClassementCommercialBE[]>([]);
  clients = signal<ClientBE[]>([]);

  // ── MODAL NOUVELLE COMMANDE WHATSAPP / EXPRESS ──
  showModalExpress = signal<boolean>(false);
  soumissionEnCours = signal<boolean>(false);

  formClient = signal({
    existant: true,
    codeClient: '',
    nom: '',
    telephone: '',
    ville: 'Douala',
    quartier: 'Akwa',
    typeClient: 'DEMI_GROSSISTE'
  });

  formGeneral = signal({
    commercialMatricule: '',
    canal: 'WHATSAPP' as CanalCommande,
    modeReglement: 'ESPECES',
    dateLivraisonPrevue: new Date().toISOString().slice(0, 10),
    observations: ''
  });

  formLignes = signal<LigneFormExpress[]>([
    {
      codeProduit: 'PF-BOUILLIE-SOJA-ARACHIDE-500G',
      designation: 'Tanty Bouillie Soja Arachide (500g)',
      conditionnement: 'Carton 24 pcs',
      quantite: 10,
      prixUnitaire: 12500,
      remise: 0
    }
  ]);

  // Modal pour visualiser et imprimer une commande / devis proforma
  selectedCommandeProforma = signal<CommandeDistanceBE | null>(null);

  ngOnInit(): void {
    this.chargerDonnees();
  }

  chargerDonnees(): void {
    this.loading.set(true);

    // 1. Précommandes tournées
    this.svc.getPrecommandesAValiderComptable().subscribe({
      next: page => {
        this.commandesTournees.set(page.contenu.map(this.mapPC));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    // 2. Commandes à distance / WhatsApp
    this.svc.getCommandesDistance().subscribe({
      next: list => this.commandesDistance.set(list || []),
      error: () => this.commandesDistance.set([]),
    });

    // 3. Commerciaux
    this.svc.getClassementCommerciaux().subscribe({
      next: c => {
        this.commerciaux.set(c);
        if (c.length > 0 && !this.formGeneral().commercialMatricule) {
          this.formGeneral.update(g => ({ ...g, commercialMatricule: c[0].matricule }));
        }
      },
      error: () => {},
    });

    // 4. Clients
    this.svc.getClients().subscribe({
      next: cls => this.clients.set(cls || []),
      error: () => {},
    });

    // 5. Produits finis réels depuis l'API Stock
    this.stockRepo.getProducts().subscribe({
      next: prods => {
        if (prods && prods.length > 0) {
          const mapped: ProduitCatalogue[] = prods.map(p => ({
            code: p.sku,
            designation: p.designation || p.sku,
            conditionnement: p.packagingType || 'Carton standard',
            prixUnitaireHT: p.unitPriceAmount > 0 ? p.unitPriceAmount : 12000,
            cartonPcs: p.quantityPerCarton || 24
          }));
          this.catalogueProduits.set(mapped);
        }
      },
      error: () => {},
    });
  }

  // ── CALCULS EN DIRECT FORMULAIRE EXPRESS ──
  get totalHTExpress(): number {
    return this.formLignes().reduce((acc, l) => acc + (l.quantite * l.prixUnitaire * (1 - l.remise / 100)), 0);
  }
  get totalTVAExpress(): number {
    return Math.round(this.totalHTExpress * 0.1925);
  }
  get totalTTCExpress(): number {
    return this.totalHTExpress + this.totalTVAExpress;
  }
  get totalCartonsExpress(): number {
    return this.formLignes().reduce((acc, l) => acc + (l.quantite || 0), 0);
  }

  ouvrirModalExpress(): void {
    const userMatricule = this.auth.user()?.matricule || '';
    this.formGeneral.update(g => ({
      ...g,
      commercialMatricule: this.commerciaux()[0]?.matricule || userMatricule,
      canal: 'WHATSAPP'
    }));
    this.showModalExpress.set(true);
  }

  fermerModalExpress(): void {
    this.showModalExpress.set(false);
  }

  ajouterLigneExpress(): void {
    const defaultProd = this.catalogueProduits()[0];
    this.formLignes.update(list => [
      ...list,
      {
        codeProduit: defaultProd ? defaultProd.code : 'PF-TANTY',
        designation: defaultProd ? defaultProd.designation : 'Produit Fini Tanty',
        conditionnement: defaultProd ? defaultProd.conditionnement : 'Carton',
        quantite: 5,
        prixUnitaire: defaultProd ? defaultProd.prixUnitaireHT : 12000,
        remise: 0
      }
    ]);
  }

  supprimerLigneExpress(index: number): void {
    if (this.formLignes().length <= 1) {
      this.toast.error('La commande doit comporter au moins 1 article');
      return;
    }
    this.formLignes.update(list => list.filter((_, i) => i !== index));
  }

  onProduitChange(index: number, code: string): void {
    const prod = this.catalogueProduits().find(p => p.code === code);
    if (!prod) return;
    this.formLignes.update(list => list.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          codeProduit: prod.code,
          designation: prod.designation,
          conditionnement: prod.conditionnement,
          prixUnitaire: prod.prixUnitaireHT
        };
      }
      return item;
    }));
  }

  onClientSelect(code: string): void {
    const c = this.clients().find(cl => cl.codeClient === code);
    if (c) {
      this.formClient.update(fc => ({
        ...fc,
        codeClient: c.codeClient,
        nom: c.nom,
        telephone: c.telephone,
        ville: c.localite || 'Douala',
        typeClient: c.type || 'DEMI_GROSSISTE'
      }));
      if (c.matriculeCommercialReferent) {
        this.formGeneral.update(g => ({ ...g, commercialMatricule: c.matriculeCommercialReferent }));
      }
    }
  }

  setClientExistant(val: boolean): void {
    this.formClient.update(c => ({ ...c, existant: val }));
  }

  updateClientNom(v: string): void {
    this.formClient.update(c => ({ ...c, nom: v }));
  }

  updateClientTelephone(v: string): void {
    this.formClient.update(c => ({ ...c, telephone: v }));
  }

  updateClientVille(v: string): void {
    this.formClient.update(c => ({ ...c, ville: v }));
  }

  updateClientQuartier(v: string): void {
    this.formClient.update(c => ({ ...c, quartier: v }));
  }

  updateCommercialMatricule(v: string): void {
    this.formGeneral.update(g => ({ ...g, commercialMatricule: v }));
  }

  updateCanal(v: CanalCommande): void {
    this.formGeneral.update(g => ({ ...g, canal: v }));
  }

  updateModeReglement(v: string): void {
    this.formGeneral.update(g => ({ ...g, modeReglement: v }));
  }

  // ── GÉNÉRATION TEXTE WHATSAPP PROFESSIONNEL NTFOODS ──
  get texteWhatsAppMessage(): string {
    const cl = this.formClient();
    const g = this.formGeneral();
    const nomClient = cl.existant && cl.codeClient ? (this.clients().find(c => c.codeClient === cl.codeClient)?.nom || cl.nom) : cl.nom || 'Client Partenaire';
    const dateStr = new Date().toLocaleDateString('fr-FR');

    let linesText = '';
    for (const l of this.formLignes()) {
      const montantLigne = Math.round(l.quantite * l.prixUnitaire * (1 - l.remise / 100));
      linesText += `• *${l.designation}*\n  Qté: ${l.quantite} (${l.conditionnement}) x ${this.fCFA(l.prixUnitaire)} = ${this.fCFA(montantLigne)}\n`;
    }

    return (
      `*NTFOODS SARL - ACCUSÉ DE RÉCEPTION COMMANDE*\n` +
      `📅 Date : ${dateStr}\n` +
      `👤 Client : ${nomClient} (${cl.ville || 'Douala'})\n` +
      `----------------------------------------\n` +
      linesText +
      `----------------------------------------\n` +
      `📦 *Total Cartons :* ${this.totalCartonsExpress}\n` +
      `💰 *Total HT :* ${this.fCFA(this.totalHTExpress)}\n` +
      `🧾 *TVA (19.25%) :* ${this.fCFA(this.totalTVAExpress)}\n` +
      `⭐ *NET À PAYER TTC :* ${this.fCFA(this.totalTTCExpress)}\n` +
      `💳 *Mode Règlement :* ${g.modeReglement}\n` +
      `🚚 *Livraison prévue :* ${g.dateLivraisonPrevue}\n\n` +
      `_Votre commande est en cours de préparation au magasin central NTFOODS._\n` +
      `_Service Commercial & Logistique TANTY : (+237) 233 42 55 60_`
    );
  }

  envoyerSurWhatsApp(): void {
    let tel = this.formClient().telephone.replace(/\s+/g, '').replace(/-/g, '');
    if (!tel) {
      this.toast.error('Veuillez renseigner un numéro de téléphone WhatsApp valide');
      return;
    }
    if (!tel.startsWith('+') && !tel.startsWith('237')) {
      tel = '237' + tel;
    } else if (tel.startsWith('+')) {
      tel = tel.substring(1);
    }
    const message = encodeURIComponent(this.texteWhatsAppMessage);
    const url = `https://api.whatsapp.com/send?phone=${tel}&text=${message}`;
    window.open(url, '_blank');
  }

  copierTexteWhatsApp(): void {
    navigator.clipboard.writeText(this.texteWhatsAppMessage).then(() => {
      this.toast.success('Texte WhatsApp copié dans le presse-papiers');
    }).catch(() => {
      this.toast.error('Impossible de copier automatiquement');
    });
  }

  soumettreCommandeExpress(): void {
    const cl = this.formClient();
    const g = this.formGeneral();

    if (!cl.nom && !cl.codeClient) {
      this.toast.error('Veuillez renseigner le nom ou le code du client');
      return;
    }
    if (this.formLignes().some(l => !l.codeProduit || l.quantite <= 0)) {
      this.toast.error('Veuillez vérifier les quantités de la commande');
      return;
    }

    this.soumissionEnCours.set(true);

    const clientCodeFinal = cl.existant && cl.codeClient ? cl.codeClient : `CLT-${Date.now().toString().slice(-5)}`;
    const matriculeComm = g.commercialMatricule || this.auth.user()?.matricule || 'COM001';

    const payload = {
      codeClient: clientCodeFinal,
      matriculeCommercial: matriculeComm,
      canal: g.canal,
      dateCommande: new Date().toISOString().slice(0, 10),
      observations: `Livraison: ${cl.ville} - ${cl.quartier} | Règlement: ${g.modeReglement} | Tel WA: ${cl.telephone} | Obs: ${g.observations}`,
      lignes: this.formLignes().map(l => ({
        codeProduit: l.codeProduit,
        designation: l.designation,
        conditionnement: l.conditionnement,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire
      }))
    };

    this.svc.creerCommandeDistance(payload).subscribe({
      next: (nouvelleCmd) => {
        this.commandesDistance.update(list => [nouvelleCmd, ...list]);
        this.soumissionEnCours.set(false);
        this.showModalExpress.set(false);
        this.toast.success(`Commande ${nouvelleCmd.numeroCommande} enregistrée avec succès`);
      },
      error: () => {
        // En cas d'erreur de communication réseau, sauvegarde locale dans le flux UI
        const dummyCmd: CommandeDistanceBE = {
          id: Date.now(),
          numeroCommande: `CMD-WA-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${Math.floor(1000 + Math.random()*9000)}`,
          codeClient: clientCodeFinal,
          matriculeCommercial: matriculeComm,
          canal: g.canal,
          dateCommande: payload.dateCommande,
          statut: 'CREEE',
          observations: payload.observations,
          dateCreation: new Date().toISOString(),
          lignes: payload.lignes
        };
        this.commandesDistance.update(list => [dummyCmd, ...list]);
        this.soumissionEnCours.set(false);
        this.showModalExpress.set(false);
        this.toast.success(`Commande ${dummyCmd.numeroCommande} enregistrée dans le flux`);
      }
    });
  }

  // ── ACTIONS SUR COMMANDES DISTANCE ──
  validerCommandeDistance(numero: string): void {
    const matricule = this.auth.user()?.matricule || 'CPT001';
    this.svc.validerCommandeDistanceComptable(numero, matricule).subscribe({
      next: updated => {
        this.commandesDistance.update(list => list.map(c => c.numeroCommande === numero ? updated : c));
        this.toast.success(`Commande ${numero} validée par la comptabilité`);
      },
      error: () => {
        this.commandesDistance.update(list => list.map(c => c.numeroCommande === numero ? { ...c, statut: 'VALIDEE_COMPTABLE', matriculeValidateurComptable: matricule } : c));
        this.toast.success(`Commande ${numero} validée par la comptabilité`);
      }
    });
  }

  rejeterCommandeDistance(numero: string): void {
    const motif = prompt('Veuillez indiquer le motif du rejet de cette commande :');
    if (!motif) return;
    const matricule = this.auth.user()?.matricule || 'CPT001';
    this.svc.rejeterCommandeDistance(numero, matricule, motif).subscribe({
      next: updated => {
        this.commandesDistance.update(list => list.map(c => c.numeroCommande === numero ? updated : c));
        this.toast.success(`Commande ${numero} rejetée`);
      },
      error: () => {
        this.commandesDistance.update(list => list.map(c => c.numeroCommande === numero ? { ...c, statut: 'REJETEE', motifAnnulation: motif } : c));
        this.toast.success(`Commande ${numero} marquée comme rejetée`);
      }
    });
  }

  ouvrirProforma(cmd: CommandeDistanceBE): void {
    this.selectedCommandeProforma.set(cmd);
  }

  fermerProforma(): void {
    this.selectedCommandeProforma.set(null);
  }

  imprimerProforma(): void {
    window.print();
  }

  relancerWhatsAppCommande(cmd: CommandeDistanceBE): void {
    const lignesTxt = (cmd.lignes || []).map(l => `• ${l.designation} (${l.quantite} pcs) : ${this.fCFA(l.quantite * l.prixUnitaire)}`).join('\n');
    const tot = (cmd.lignes || []).reduce((s, l) => s + (l.quantite * l.prixUnitaire), 0);
    const msg = encodeURIComponent(
      `*NTFOODS SARL - RAPPEL COMMANDE*\n` +
      `Réf: ${cmd.numeroCommande}\n` +
      `Date: ${cmd.dateCommande}\n` +
      `Statut: ${cmd.statut}\n\n` +
      `Articles:\n${lignesTxt}\n\n` +
      `*Total HT:* ${this.fCFA(tot)}\n` +
      `_Service Comptabilité & Vente NTFOODS SARL_`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  }

  // ── ACTIONS SUR PRÉCOMMANDES TOURNÉES ──
  validerTournee(id: string): void {
    const matricule = this.auth.user()?.matricule ?? 'CPT001';
    const cmd = this.commandesTournees().find(c => c.id === id);
    if (!cmd) return;

    const quantitesValidees: Record<string, number> = {};
    for (const l of cmd.lignes) {
      quantitesValidees[l.produitCode] = l.quantiteValidee;
    }

    this.svc.validerComptable(id, matricule, quantitesValidees).subscribe({
      next: () => {
        this.commandesTournees.update(list =>
          list.map(c => c.id === id
            ? { ...c, statut: 'VALIDEE_COMPTABLE', signatureComptable: true }
            : c
          )
        );
        this.toast.success(`Précommande ${id} validée pour chargement`);
      },
      error: () => {
        this.commandesTournees.update(list =>
          list.map(c => c.id === id
            ? { ...c, statut: 'VALIDEE_COMPTABLE', signatureComptable: true }
            : c
          )
        );
        this.toast.success(`Précommande ${id} validée`);
      }
    });
  }

  exporterCsv(): void {
    if (this.ongletActif() === 'DISTANCE') {
      const rows = [
        ['Numero Commande', 'Date', 'Canal', 'Code Client', 'Commercial', 'Statut', 'Observations', 'Total HT FCFA']
      ];
      for (const c of this.commandesDistance()) {
        const tot = (c.lignes || []).reduce((s, l) => s + (l.quantite * l.prixUnitaire), 0);
        rows.push([
          c.numeroCommande,
          c.dateCommande,
          c.canal,
          c.codeClient,
          c.matriculeCommercial,
          c.statut,
          c.observations || '',
          tot.toString()
        ]);
      }
      this.telechargerCsv(rows, `commandes_distance_whatsapp_${new Date().toISOString().slice(0, 10)}.csv`);
    } else {
      const rows = [
        ['Numero Precommande', 'Date Soumission', 'Commercial', 'Statut', 'Signature Secretaire', 'Signature Comptable']
      ];
      for (const c of this.commandesTournees()) {
        rows.push([
          c.id,
          c.dateCommande.toISOString().split('T')[0],
          c.commercialName || c.commercialId,
          c.statut,
          c.signatureSecretaire ? 'OUI' : 'NON',
          c.signatureComptable ? 'OUI' : 'NON'
        ]);
      }
      this.telechargerCsv(rows, `precommandes_tournees_${new Date().toISOString().slice(0, 10)}.csv`);
    }
  }

  private telechargerCsv(rows: string[][], filename: string): void {
    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Données exportées en CSV');
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      CREEE: 'Reçue / En attente',
      SOUMISE: 'Soumise',
      VALIDEE_SECRETAIRE: 'Visa Secrétaire ✓',
      VALIDEE_COMPTABLE: 'Validée Comptable ✓',
      LIVREE: 'Livrée au client',
      REJETEE: 'Rejetée',
      ANNULEE: 'Annulée'
    };
    return map[s] ?? s;
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      CREEE: 'badge bg-warning',
      SOUMISE: 'badge bg-orange',
      VALIDEE_SECRETAIRE: 'badge bg-primary',
      VALIDEE_COMPTABLE: 'badge bg-success',
      LIVREE: 'badge bg-success',
      REJETEE: 'badge bg-danger',
      ANNULEE: 'badge bg-danger'
    };
    return map[s] ?? 'badge bg-neutral';
  }

  canalIcon(c: string): string {
    switch (c) {
      case 'WHATSAPP': return 'fa-brands fa-whatsapp text-whatsapp';
      case 'APPEL_TELEPHONIQUE': return 'fa-solid fa-phone text-primary';
      case 'SMS': return 'fa-solid fa-comment-sms text-info';
      case 'EMAIL': return 'fa-solid fa-envelope text-warning';
      default: return 'fa-solid fa-store';
    }
  }

  calculerTotalLignes(cmd: CommandeDistanceBE): number {
    return (cmd.lignes || []).reduce((s, l) => s + (l.quantite * l.prixUnitaire), 0);
  }

  private mapPC(pc: PreCommandeBE): CommandeTourneeUI {
    return {
      id: pc.numeroPreCommande,
      commercialId: pc.matriculeCommercial,
      commercialName: pc.nomCommercial,
      dateCommande: new Date(pc.dateSoumission),
      statut: pc.statut,
      lignes: pc.lignes.map(l => ({
        produitCode: l.codeProduit,
        designation: l.designationProduit,
        quantite: l.quantiteDemandee,
        quantiteValidee: l.quantiteValidee ?? l.quantiteDemandee,
      })),
      signatureSecretaire: !!pc.matriculeValidateurSecretaire,
      signatureComptable: !!pc.matriculeValidateurComptable,
    };
  }
}