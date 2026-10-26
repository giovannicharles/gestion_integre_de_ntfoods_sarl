import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ProductionService, RegistreProductionBE, AgentProductionBE, CodePosteRef,
} from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Texte normalisé pour la recherche : minuscules et sans accents. */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export type FiltrePresence = 'tous' | 'present' | 'absent';

/** Ligne du formulaire de correction : un employé, son poste, sa présence du jour. */
interface LigneForm {
  matriculeEmploye: string;
  nomEmploye: string;
  poste: string;
  present: boolean;
  motifAbsence: string;
  heureArrivee: string;
  qteRealisee: number | null;
  unite: string;
}

/** Une ligne de registre mise à plat, avec la date et le PPH du registre dont elle vient. */
interface LigneVue {
  date: string;
  referencePPH: string;
  matriculeEmploye: string;
  nomEmploye: string;
  poste: string;
  present: boolean;
  motifAbsence: string | null;
  heureArrivee: string | null;
  qteRealisee: number;
  unite: string | null;
}

/**
 * REGISTRE JOURNALIER DES EMPLOYÉS — Responsable de Salle.
 * Consultation, recherche et export sur une période ; la création d'un registre (présence, poste, quantité
 * réalisée de chaque employé pour un PPH et un jour) se fait sur la page « Registre Employés », partagée avec le
 * chef de production, pré-remplie depuis l'affectation du jour.
 * Le registre du jour peut être corrigé depuis cette page tant que sa date est la journée en cours : passé ce
 * délai (minuit), le serveur refuse toute correction et le registre devient une preuve d'audit définitive.
 *
 * ⚠️ Pas d'endpoint d'export PDF/Excel dédié au registre journalier : l'export CSV est généré côté client à
 * partir des données réelles affichées (donc déjà filtrées).
 */
@Component({
  selector: 'app-rs-registre-journalier',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-registre-journalier.component.html',
  styleUrls: ['./rs-registre-journalier.component.css'],
})
export class RsRegistreJournalierComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();

  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);

  readonly registres = signal<RegistreProductionBE[]>([]);
  readonly debut = signal(dateLocaleIso(this.joursAvant(14)));
  readonly fin = signal(this.aujourdhui);

  readonly recherche = signal('');
  readonly posteChoisi = signal('');
  readonly presenceChoisie = signal<FiltrePresence>('tous');

  readonly agents = signal<AgentProductionBE[]>([]);
  readonly postes = signal<CodePosteRef[]>([]);

  /** Vrai quand la période couvre aujourd'hui mais qu'aucun registre n'a encore été créé pour ce jour. */
  readonly registreAujourdhuiManquant = computed(() =>
    this.debut() <= this.aujourdhui && this.aujourdhui <= this.fin()
    && !this.registres().some(r => r.date === this.aujourdhui));

  /** Le registre d'aujourd'hui, s'il est dans la période chargée : seul celui-ci reste corrigible. */
  readonly registreDuJour = computed(() => this.registres().find(r => r.date === this.aujourdhui) ?? null);

  // ── Correction du registre du jour ──
  readonly correctionOuverte = signal(false);
  readonly lignesCorrection = signal<LigneForm[]>([]);
  readonly envoiCorrection = signal(false);
  readonly erreurCorrection = signal('');

  /** Agents proposés pour une nouvelle ligne : actifs, pas déjà présents dans la correction. */
  agentsDisponibles(iExclu: number): AgentProductionBE[] {
    const utilises = new Set(this.lignesCorrection().filter((_, i) => i !== iExclu).map(l => l.matriculeEmploye));
    return this.agents().filter(a => a.actif && !utilises.has(a.matricule));
  }

  /** Erreur bloquante d'une ligne de correction, ou null. */
  erreurLigneCorrection(l: LigneForm): string | null {
    if (!l.matriculeEmploye) return 'Choisissez un employé.';
    if (!l.poste) return 'Choisissez un poste.';
    if (l.present && (l.qteRealisee === null || !Number.isFinite(l.qteRealisee) || l.qteRealisee < 0)) {
      return 'Quantité réalisée : nombre positif.';
    }
    if (l.present && !/^([01]\d|2[0-3]):[0-5]\d$/.test(l.heureArrivee)) return 'Heure d\'arrivée au format HH:mm.';
    return null;
  }

  readonly erreursCorrection = computed(() => {
    const vus = new Set<string>();
    const doublons = new Set<string>();
    const msgs: string[] = [];
    this.lignesCorrection().forEach((l, i) => {
      const err = this.erreurLigneCorrection(l);
      if (err) msgs.push(`Ligne ${i + 1} (${l.nomEmploye || 'employé non choisi'}) : ${err}`);
      if (l.matriculeEmploye) {
        if (vus.has(l.matriculeEmploye)) doublons.add(l.matriculeEmploye);
        vus.add(l.matriculeEmploye);
      }
    });
    doublons.forEach(m => msgs.push(`${m} figure sur plusieurs lignes.`));
    return msgs;
  });

  readonly peutEnregistrerCorrection = computed(() =>
    this.lignesCorrection().length > 0 && this.erreursCorrection().length === 0 && !this.envoiCorrection());

  readonly lignesAplaties = computed<LigneVue[]>(() =>
    this.registres().flatMap(r => r.lignes.map(l => ({ ...l, date: r.date, referencePPH: r.referencePPH }))));

  readonly postesDisponibles = computed(() =>
    [...new Set(this.lignesAplaties().map(l => l.poste))].sort((a, b) => a.localeCompare(b, 'fr')));

  readonly lignesFiltrees = computed(() => {
    const motif = normaliser(this.recherche());
    const poste = this.posteChoisi();
    const presence = this.presenceChoisie();
    return this.lignesAplaties()
      .filter(l =>
        (!motif || normaliser(`${l.nomEmploye} ${l.matriculeEmploye}`).includes(motif))
        && (!poste || l.poste === poste)
        && (presence === 'tous' || (presence === 'present') === l.present))
      .sort((a, b) => b.date.localeCompare(a.date) || a.nomEmploye.localeCompare(b.nomEmploye, 'fr'));
  });

  readonly nbRegistres = computed(() => this.registres().length);
  readonly nbLignes = computed(() => this.lignesAplaties().length);
  readonly nbPresents = computed(() => this.lignesAplaties().filter(l => l.present).length);
  readonly tauxPresence = computed(() => this.nbLignes() > 0 ? Math.round(this.nbPresents() / this.nbLignes() * 100) : null);

  ngOnInit(): void {
    this.charger();
    this.svc.getAgentsProduction().subscribe({ next: a => this.agents.set(a), error: () => this.agents.set([]) });
    this.svc.getPostesProduction().subscribe({ next: p => this.postes.set(p), error: () => this.postes.set([]) });
  }

  charger(): void {
    if (this.fin() < this.debut()) {
      this.erreur.set('La date de fin précède la date de début.');
      return;
    }
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getRegistres({ debut: this.debut(), fin: this.fin() }).subscribe({
      next: r => { this.registres.set(r); this.chargement.set(false); },
      error: (e: unknown) => {
        this.chargement.set(false);
        this.registres.set([]);
        this.noterErreur(e, 'Les registres n\'ont pas pu être chargés.');
      },
    });
  }

  reinitialiserFiltres(): void {
    this.recherche.set('');
    this.posteChoisi.set('');
    this.presenceChoisie.set('tous');
  }

  ouvrirCorrection(): void {
    const r = this.registreDuJour();
    if (!r) return;
    this.lignesCorrection.set(r.lignes.map(l => ({
      matriculeEmploye: l.matriculeEmploye, nomEmploye: l.nomEmploye, poste: l.poste,
      present: l.present, motifAbsence: l.motifAbsence ?? '', heureArrivee: l.heureArrivee ?? '',
      qteRealisee: l.qteRealisee, unite: l.unite ?? 'KG',
    })));
    this.erreurCorrection.set('');
    this.correctionOuverte.set(true);
  }

  fermerCorrection(): void {
    if (this.envoiCorrection()) return;
    this.correctionOuverte.set(false);
  }

  ajouterLigneCorrection(): void {
    this.lignesCorrection.update(ls => [...ls, this.ligneVide()]);
  }

  retirerLigneCorrection(i: number): void {
    this.lignesCorrection.update(ls => ls.filter((_, k) => k !== i));
  }

  choisirAgentCorrection(i: number, matricule: string): void {
    const agent = this.agents().find(a => a.matricule === matricule);
    this.lignesCorrection.update(ls => ls.map((l, k) => k === i
      ? { ...l, matriculeEmploye: matricule, nomEmploye: agent?.nomComplet ?? l.nomEmploye }
      : l));
  }

  majLigneCorrection(i: number, champ: keyof LigneForm, valeur: unknown): void {
    this.lignesCorrection.update(ls => ls.map((l, k) => k === i ? { ...l, [champ]: valeur } : l));
  }

  libellePoste(code: string): string {
    return this.postes().find(p => p.code === code)?.libelle ?? code;
  }

  enregistrerCorrection(): void {
    const r = this.registreDuJour();
    if (!r || !this.peutEnregistrerCorrection()) return;
    this.envoiCorrection.set(true);
    this.erreurCorrection.set('');
    const lignes = this.lignesCorrection().map(l => ({
      matriculeEmploye: l.matriculeEmploye, nomEmploye: l.nomEmploye, poste: l.poste, present: l.present,
      motifAbsence: l.present ? undefined : (l.motifAbsence.trim() || undefined),
      heureArrivee: l.present ? l.heureArrivee : undefined,
      qteRealisee: l.present ? Number(l.qteRealisee ?? 0) : 0,
      unite: l.present ? (l.unite || undefined) : undefined,
    }));
    this.svc.modifierRegistre(r.referencePPH, r.date, { lignes }).subscribe({
      next: updated => {
        this.registres.update(list => list.map(x => x.date === updated.date && x.referencePPH === updated.referencePPH ? updated : x));
        this.correctionOuverte.set(false);
        this.envoiCorrection.set(false);
        this.erreur.set('');
      },
      error: (e: unknown) => {
        this.envoiCorrection.set(false);
        this.noterErreur(e, 'La correction n\'a pas pu être enregistrée.');
        if ((e as { status?: number })?.status === 409) {
          this.erreurCorrection.set('Ce registre ne décrit plus la journée en cours : il ne peut plus être corrigé.');
        } else {
          this.erreurCorrection.set(this.erreur());
        }
      },
    });
  }

  private ligneVide(): LigneForm {
    return { matriculeEmploye: '', nomEmploye: '', poste: '', present: true, motifAbsence: '', heureArrivee: '', qteRealisee: null, unite: 'KG' };
  }

  /** Exporte les lignes actuellement affichées (après filtres), pas toute la période chargée. */
  exporterCsv(): void {
    const lignes = this.lignesFiltrees();
    if (!lignes.length) return;
    const entetes = ['Date', 'PPH', 'Employé', 'Matricule', 'Poste', 'Présent', 'Motif absence', 'Heure arrivée', 'Quantité réalisée', 'Unité'];
    const rows = lignes.map(l => [
      l.date, l.referencePPH, l.nomEmploye, l.matriculeEmploye, l.poste,
      l.present ? 'Oui' : 'Non', l.motifAbsence ?? '', l.heureArrivee ?? '',
      String(l.qteRealisee), l.unite ?? '',
    ]);
    const csv = [entetes, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registre-journalier-${this.debut()}-${this.fin()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private joursAvant(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  private noterErreur(e: unknown, repli: string): void {
    const err = e as { status?: number; error?: { erreur?: string; message?: string } };
    if (err?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    this.erreur.set(err?.error?.erreur || err?.error?.message || repli);
  }
}
