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
  { value: 'WHATSAPP', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp' },
  { value: 'APPEL_TELEPHONIQUE', label: 'Téléphone', icon: 'fa-solid fa-phone' },
  { value: 'SMS', label: 'SMS', icon: 'fa-solid fa-comment-sms' },
  { value: 'EMAIL', label: 'Email', icon: 'fa-solid fa-envelope' },
];

interface LigneFormUI { codeProduit: string; designation: string; conditionnement: string; quantite: number; prixUnitaire: number; }

/**
 * Commandes clients hors tournée (§5.7, CommandeDistance) — téléphone, WhatsApp, SMS,
 * email. Écran UNIQUE et partagé : jusqu'au 2026-10-16, cette fonctionnalité existait
 * entièrement côté backend (contrôleur, workflow de validation croisée Secrétaire→
 * Comptable) sans AUCUNE interface, et seul le rôle Commercial pouvait la déclencher —
 * alors qu'un client contacte aussi bien le secrétariat, la Chargée RP, le comptable
 * ou le Contrôleur Général. Routé depuis plusieurs modules (voir *.routes.ts) plutôt que
 * dupliqué : les actions visibles s'adaptent au rôle courant (`AuthService.hasAnyRole`),
 * pas à la route par laquelle on y arrive.
 */
@Component({
  selector: 'app-commande-client',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './commande-client.component.html',
})
export class CommandeClientComponent implements OnInit {
  private readonly svc = inject(CommercialService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = fCFA;
  canaux = CANAUX;

  loading = signal(true);
  loadError = signal<string | null>(null);
  commandes = signal<CommandeDistanceBE[]>([]);
  clients = signal<ClientBE[]>([]);
  produitsFinis = signal<Product[]>([]);
  filterStatut = signal<'TOUTES' | 'RECUE' | 'VALIDEE_SECRETAIRE' | 'VALIDEE_COMPTABLE' | 'LIVREE'>('TOUTES');

  // ── Rôle courant → quelles actions afficher (le serveur reste la seule autorité réelle) ──
  peutValiderSecretaire = computed(() => this.auth.hasAnyRole(['SECRETAIRE', 'ADMIN']));
  peutValiderComptable = computed(() => this.auth.hasAnyRole(['COMPTABLE', 'ADMIN']));
  peutGerer = computed(() => this.auth.hasAnyRole(['COMMERCIAL', 'DIRECTEUR_COMMERCIAL', 'DIRECTEUR_GENERAL', 'ADMIN']));

  liste = computed(() => {
    const f = this.filterStatut();
    return f === 'TOUTES' ? this.commandes() : this.commandes().filter(c => c.statut === f);
  });
  nbRecues = computed(() => this.commandes().filter(c => c.statut === 'RECUE').length);
  nbValideesSecretaire = computed(() => this.commandes().filter(c => c.statut === 'VALIDEE_SECRETAIRE').length);
  nbValideesComptable = computed(() => this.commandes().filter(c => c.statut === 'VALIDEE_COMPTABLE').length);
  nbLivrees = computed(() => this.commandes().filter(c => c.statut === 'LIVREE').length);

  showForm = signal(false);
  saving = signal(false);
  matriculeActeur = this.auth.user()?.matricule ?? '';
  form = signal({ codeClient: '', canal: 'WHATSAPP' as CanalCommande, dateCommande: this.formatDate(new Date()), observations: '' });
  lignesForm = signal<LigneFormUI[]>([]);

  showRejeter = signal<CommandeDistanceBE | null>(null);
  motifRejet = '';
  showAnnuler = signal<CommandeDistanceBE | null>(null);
  motifAnnulation = '';
  actionEnCours = signal<string | null>(null);

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

  canalLabel(c: string): string {
    return this.canaux.find(x => x.value === c)?.label ?? c;
  }
  canalIcon(c: string): string {
    return this.canaux.find(x => x.value === c)?.icon ?? 'fa-solid fa-circle-question';
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      RECUE: 'badge bg-orange', VALIDEE_SECRETAIRE: 'badge bg-neutral',
      VALIDEE_COMPTABLE: 'badge bg-success', LIVREE: 'badge bg-success',
      REJETEE: 'badge bg-red', ANNULEE: 'badge bg-red',
    };
    return map[s] ?? 'badge bg-neutral';
  }
  statutLabel(s: string): string {
    const map: Record<string, string> = {
      RECUE: 'Reçue — att. secrétaire', VALIDEE_SECRETAIRE: 'Att. comptable',
      VALIDEE_COMPTABLE: 'Prête à livrer', LIVREE: 'Livrée',
      REJETEE: 'Rejetée', ANNULEE: 'Annulée',
    };
    return map[s] ?? s;
  }

  totalLigne(l: { quantite: number; prixUnitaire: number }): number {
    return l.quantite * l.prixUnitaire;
  }
  totalCommande(c: CommandeDistanceBE): number {
    return c.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
  }

  // ── Création ──────────────────────────────────────────────────────────

  ouvrirForm(): void {
    this.form.set({ codeClient: '', canal: 'WHATSAPP', dateCommande: this.formatDate(new Date()), observations: '' });
    this.lignesForm.set([]);
    this.showForm.set(true);
  }

  majChamp<K extends 'codeClient' | 'canal' | 'dateCommande' | 'observations'>(champ: K, valeur: any): void {
    this.form.update(f => ({ ...f, [champ]: valeur }));
  }

  ajouterLigne(): void {
    const premier = this.produitsFinis()[0];
    this.lignesForm.update(l => [...l, {
      codeProduit: premier?.sku ?? '', designation: premier?.designation ?? '',
      conditionnement: premier?.packagingType ?? 'UNITE', quantite: 1,
      prixUnitaire: premier?.unitPriceAmount ?? 0,
    }]);
  }
  retirerLigne(i: number): void {
    this.lignesForm.update(l => l.filter((_, idx) => idx !== i));
  }
  changerProduitLigne(i: number, sku: string): void {
    const p = this.produitsFinis().find(x => x.sku === sku);
    this.lignesForm.update(l => l.map((ligne, idx) => idx === i ? {
      ...ligne, codeProduit: sku, designation: p?.designation ?? sku,
      conditionnement: p?.packagingType ?? ligne.conditionnement, prixUnitaire: p?.unitPriceAmount ?? ligne.prixUnitaire,
    } : ligne));
  }
  majLigne(i: number, champ: 'quantite' | 'prixUnitaire', valeur: number): void {
    this.lignesForm.update(l => l.map((ligne, idx) => idx === i ? { ...ligne, [champ]: valeur } : ligne));
  }

  formValide(): boolean {
    const f = this.form();
    return !!f.codeClient && this.lignesForm().length > 0 && this.lignesForm().every(l => l.quantite > 0 && l.codeProduit);
  }

  enregistrer(): void {
    if (!this.formValide()) {
      this.toast.error('Client et au moins une ligne (produit + quantité) sont obligatoires.', 'Formulaire incomplet');
      return;
    }
    const f = this.form();
    const lignes: LigneCommandeDistanceRequest[] = this.lignesForm().map(l => ({
      codeProduit: l.codeProduit, designation: l.designation, conditionnement: l.conditionnement,
      quantite: l.quantite, prixUnitaire: l.prixUnitaire,
    }));
    this.saving.set(true);
    this.svc.creerCommandeDistance({
      codeClient: f.codeClient, matriculeCommercial: this.matriculeActeur, canal: f.canal,
      dateCommande: f.dateCommande, observations: f.observations.trim() || undefined, lignes,
    }).subscribe({
      next: c => {
        this.saving.set(false);
        this.showForm.set(false);
        this.commandes.update(list => [c, ...list]);
        this.toast.success(`Commande ${c.numeroCommande} enregistrée — en attente de validation secrétaire.`);
      },
      error: e => { this.saving.set(false); this.toast.error(extractApiError(e), "Échec de l'enregistrement"); },
    });
  }

  // ── Actions sur une commande existante ──────────────────────────────

  private remplacer(updated: CommandeDistanceBE): void {
    this.commandes.update(list => list.map(x => x.numeroCommande === updated.numeroCommande ? updated : x));
  }

  validerSecretaire(c: CommandeDistanceBE): void {
    this.actionEnCours.set(c.numeroCommande);
    this.svc.validerCommandeDistanceSecretaire(c.numeroCommande, this.matriculeActeur).subscribe({
      next: u => { this.actionEnCours.set(null); this.remplacer(u); this.toast.success(`${u.numeroCommande} validée — en attente du comptable.`); },
      error: e => { this.actionEnCours.set(null); this.toast.error(extractApiError(e), 'Échec de la validation'); },
    });
  }

  validerComptable(c: CommandeDistanceBE): void {
    this.actionEnCours.set(c.numeroCommande);
    this.svc.validerCommandeDistanceComptable(c.numeroCommande, this.matriculeActeur).subscribe({
      next: u => { this.actionEnCours.set(null); this.remplacer(u); this.toast.success(`${u.numeroCommande} validée — prête à livrer.`); },
      error: e => { this.actionEnCours.set(null); this.toast.error(extractApiError(e), 'Échec de la validation'); },
    });
  }

  livrer(c: CommandeDistanceBE): void {
    this.actionEnCours.set(c.numeroCommande);
    this.svc.livrerCommandeDistance(c.numeroCommande).subscribe({
      next: u => { this.actionEnCours.set(null); this.remplacer(u); this.toast.success(`${u.numeroCommande} marquée livrée.`); },
      error: e => { this.actionEnCours.set(null); this.toast.error(extractApiError(e), 'Échec du marquage livré'); },
    });
  }

  ouvrirRejeter(c: CommandeDistanceBE): void { this.motifRejet = ''; this.showRejeter.set(c); }
  confirmerRejeter(): void {
    const c = this.showRejeter();
    if (!c || !this.motifRejet.trim()) return;
    this.svc.rejeterCommandeDistance(c.numeroCommande, this.matriculeActeur, this.motifRejet.trim()).subscribe({
      next: u => { this.remplacer(u); this.showRejeter.set(null); this.toast.success('Commande rejetée.'); },
      error: e => this.toast.error(extractApiError(e), 'Échec du rejet'),
    });
  }

  ouvrirAnnuler(c: CommandeDistanceBE): void { this.motifAnnulation = ''; this.showAnnuler.set(c); }
  confirmerAnnuler(): void {
    const c = this.showAnnuler();
    if (!c || !this.motifAnnulation.trim()) return;
    this.svc.annulerCommandeDistance(c.numeroCommande, this.motifAnnulation.trim()).subscribe({
      next: u => { this.remplacer(u); this.showAnnuler.set(null); this.toast.success('Commande annulée.'); },
      error: e => this.toast.error(extractApiError(e), "Échec de l'annulation"),
    });
  }

  peutAnnuler(c: CommandeDistanceBE): boolean {
    return this.peutGerer() && c.statut !== 'LIVREE' && c.statut !== 'ANNULEE' && c.statut !== 'REJETEE';
  }
}
