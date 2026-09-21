import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth.service';
import {
  ParametrageMetierService,
  BaremePrimeBE, ParametrageCaisseBE, ParametrageObjectifBE, ReglesAvarieBE,
} from '../../../infrastructure/parametrage-metier.service';

type Famille = 'bareme' | 'caisse' | 'objectif' | 'avarie';

/**
 * Administration des règles métier datées.
 *
 * Ces valeurs gouvernaient auparavant des calculs depuis des constantes
 * compilées : les modifier imposait une livraison. Chaque changement prend effet
 * à une date choisie et clôture la version précédente, si bien qu'un calcul
 * passé reste justifiable par la règle qui s'appliquait alors.
 */
@Component({
  selector: 'app-parametrages-metier',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './parametrages-metier.component.html',
  styleUrls: ['./parametrages-metier.component.css'],
})
export class ParametragesMetierComponent implements OnInit {
  private readonly svc = inject(ParametrageMetierService);
  private readonly auth = inject(AuthService);

  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  onglet = signal<Famille>('bareme');
  loading = signal(false);
  message = signal<{ texte: string; type: 'succes' | 'erreur' } | null>(null);

  baremeCourant = signal<BaremePrimeBE | null>(null);
  baremeHistorique = signal<BaremePrimeBE[]>([]);
  caisseCourant = signal<ParametrageCaisseBE | null>(null);
  caisseHistorique = signal<ParametrageCaisseBE[]>([]);
  objectifCourant = signal<ParametrageObjectifBE | null>(null);
  objectifHistorique = signal<ParametrageObjectifBE[]>([]);
  avarieCourantes = signal<ReglesAvarieBE | null>(null);
  avarieHistorique = signal<ReglesAvarieBE[]>([]);

  /** Prise d'effet par défaut : demain, pour ne jamais rétroagir sur la journée en cours. */
  private readonly demain = this.fmtDate(new Date(Date.now() + 86_400_000));

  formBareme = {
    tauxGlobalMinimumPourcent: 80, tauxGammeMinimumPourcent: 75,
    montantParGammeFCFA: 3000, montantMaximumFCFA: 12000,
    dateEffet: this.demain, motif: '',
  };

  formCaisse = {
    seuilSecurisationFCFA: 500000, seuilAlerteRougeVersementFCFA: 5000,
    dateEffet: this.demain, motif: '',
  };

  formObjectif = { nombreJoursOuvres: 6, dateEffet: this.demain, motif: '' };

  formAvarie = { quantiteSeuilPhotoObligatoire: 3, dateEffet: this.demain, motif: '' };

  ngOnInit(): void {
    this.chargerTout();
  }

  changerOnglet(famille: Famille): void {
    this.onglet.set(famille);
    this.message.set(null);
  }

  private chargerTout(): void {
    this.loading.set(true);
    forkJoin({
      bareme: this.svc.getBaremeCourant(),
      baremeH: this.svc.getBaremeHistorique(),
      caisse: this.svc.getCaisseCourant(),
      caisseH: this.svc.getCaisseHistorique(),
      objectif: this.svc.getObjectifCourant(),
      objectifH: this.svc.getObjectifHistorique(),
      avarie: this.svc.getAvarieCourantes(),
      avarieH: this.svc.getAvarieHistorique(),
    }).subscribe({
      next: (r) => {
        this.baremeCourant.set(r.bareme);
        this.baremeHistorique.set(r.baremeH);
        this.caisseCourant.set(r.caisse);
        this.caisseHistorique.set(r.caisseH);
        this.objectifCourant.set(r.objectif);
        this.objectifHistorique.set(r.objectifH);
        this.avarieCourantes.set(r.avarie);
        this.avarieHistorique.set(r.avarieH);
        this.prerremplirDepuisCourant();
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  /** Les formulaires partent des valeurs en vigueur : on ajuste, on ne ressaisit pas tout. */
  private prerremplirDepuisCourant(): void {
    const b = this.baremeCourant();
    if (b) {
      this.formBareme.tauxGlobalMinimumPourcent = b.tauxGlobalMinimumPourcent;
      this.formBareme.tauxGammeMinimumPourcent = b.tauxGammeMinimumPourcent;
      this.formBareme.montantParGammeFCFA = b.montantParGammeFCFA;
      this.formBareme.montantMaximumFCFA = b.montantMaximumFCFA;
    }
    const c = this.caisseCourant();
    if (c) {
      this.formCaisse.seuilSecurisationFCFA = c.seuilSecurisationFCFA;
      this.formCaisse.seuilAlerteRougeVersementFCFA = c.seuilAlerteRougeVersementFCFA;
    }
    const o = this.objectifCourant();
    if (o) this.formObjectif.nombreJoursOuvres = o.nombreJoursOuvres;
    const a = this.avarieCourantes();
    if (a) this.formAvarie.quantiteSeuilPhotoObligatoire = a.quantiteSeuilPhotoObligatoire;
  }

  // ── Enregistrement ────────────────────────────────────────────────────────

  enregistrerBareme(): void {
    if (this.formBareme.montantMaximumFCFA < this.formBareme.montantParGammeFCFA) {
      this.afficher('Le plafond ne peut pas être inférieur au montant accordé pour une gamme.', 'erreur');
      return;
    }
    this.loading.set(true);
    this.svc.ouvrirBareme({ ...this.formBareme, matriculeAuteur: this.matricule() }).subscribe({
      next: (b) => this.apresEnregistrement(`Barème ${b.reference} en vigueur au ${b.dateDebut}.`),
      error: (e) => this.apresErreur(e),
    });
  }

  enregistrerCaisse(): void {
    this.loading.set(true);
    this.svc.ouvrirCaisse({ ...this.formCaisse, matriculeAuteur: this.matricule() }).subscribe({
      next: (p) => this.apresEnregistrement(`Seuils ${p.reference} en vigueur au ${p.dateDebut}.`),
      error: (e) => this.apresErreur(e),
    });
  }

  enregistrerObjectif(): void {
    this.loading.set(true);
    this.svc.ouvrirObjectif({ ...this.formObjectif, matriculeAuteur: this.matricule() }).subscribe({
      next: (p) => this.apresEnregistrement(`Paramétrage ${p.reference} en vigueur au ${p.dateDebut}.`),
      error: (e) => this.apresErreur(e),
    });
  }

  enregistrerAvarie(): void {
    this.loading.set(true);
    this.svc.ouvrirAvarie({ ...this.formAvarie, matriculeAuteur: this.matricule() }).subscribe({
      next: (r) => this.apresEnregistrement(`Règles ${r.reference} en vigueur au ${r.dateDebut}.`),
      error: (e) => this.apresErreur(e),
    });
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  private apresEnregistrement(texte: string): void {
    this.afficher(texte, 'succes');
    this.chargerTout();
  }

  private apresErreur(e: unknown): void {
    this.loading.set(false);
    this.afficher(this.messageErreur(e), 'erreur');
  }

  private afficher(texte: string, type: 'succes' | 'erreur'): void {
    this.message.set({ texte, type });
  }

  /** Restitue le message du serveur : il explique la règle refusée. */
  private messageErreur(e: unknown): string {
    const err = e as { error?: { message?: string; erreur?: string } };
    return err?.error?.erreur ?? err?.error?.message
      ?? "Le paramétrage n'a pas pu être enregistré.";
  }

  private matricule(): string {
    return this.auth.user()?.matricule ?? '';
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
