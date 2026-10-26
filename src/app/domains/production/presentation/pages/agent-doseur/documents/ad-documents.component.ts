import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ProductionService, SessionDosageBE, StatistiquesFutsBE,
} from '../../../../infrastructure/production.service';
import { AdSessionContextService } from '../ad-session-context.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

/** Valeur CSV : guillemets si nécessaire, point-virgule comme séparateur (Excel français). */
function cellule(v: string | number): string {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Statut = 'CLOTUREE' | 'VALIDEE' | 'EN_PAUSE' | 'EN_COURS';
type Action = 'registre-pdf' | 'registre-excel' | 'zip' | 'csv';

/**
 * TÉLÉCHARGEMENT DES DOCUMENTS — Agent Doseur.
 * Registre (PDF ou Excel) et pack ZIP d'une session de dosage, choisie sur une période (et non plus
 * seulement le jour même). Export CSV de la période : sessions et totaux de fûts et de matières.
 * Les rapports hebdomadaires et mensuels du module stock ne sont pas accessibles à ce rôle ; ces
 * exports sont donc construits à partir des sessions et des statistiques de fûts autorisées.
 */
@Component({
  selector: 'app-ad-documents',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './ad-documents.component.html',
  styleUrls: ['./ad-documents.component.css'],
})
export class AdDocumentsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly contexte = inject(AdSessionContextService);

  readonly aujourdhui = dateLocaleIso();

  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly sessions = signal<SessionDosageBE[]>([]);

  readonly debut = signal(ajouterJours(dateLocaleIso(), -6));
  readonly fin = signal(dateLocaleIso());
  readonly presetChoisi = signal<'JOUR' | 'SEMAINE' | ''>('SEMAINE');

  readonly sessionId = signal<number | null>(null);
  readonly action = signal<Action | ''>('');
  readonly erreurAction = signal('');
  readonly messageAction = signal('');

  readonly sessionsTriees = computed(() =>
    [...this.sessions()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));

  readonly selection = computed(() => this.sessions().find(s => s.id === this.sessionId()) ?? null);


  statutDe(s: SessionDosageBE): Statut {
    if (s.cloturee) return 'CLOTUREE';
    if (s.validee) return 'VALIDEE';
    if (s.enPause) return 'EN_PAUSE';
    return 'EN_COURS';
  }

  libelleStatut(s: SessionDosageBE): string {
    return { CLOTUREE: 'Clôturée', VALIDEE: 'Validée', EN_PAUSE: 'En pause', EN_COURS: 'En cours' }[this.statutDe(s)];
  }

  sommeMatieres(s: SessionDosageBE): number {
    return s.matieresUtilisees.reduce((t, m) => t + m.quantiteKg, 0);
  }

  ngOnInit(): void {
    this.charger();
  }

  choisirPreset(code: 'JOUR' | 'SEMAINE'): void {
    this.presetChoisi.set(code);
    this.debut.set(code === 'JOUR' ? this.aujourdhui : ajouterJours(this.aujourdhui, -6));
    this.fin.set(this.aujourdhui);
    this.charger();
  }

  charger(): void {
    if (this.debut() > this.fin()) {
      this.erreur.set('La date de début doit être antérieure à la date de fin.');
      return;
    }
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getSessionsDosageParPeriode(this.debut(), this.fin()).subscribe({
      next: s => {
        this.sessions.set(s);
        this.chargement.set(false);
        // Pré-sélection : la session active du contexte, sinon la plus récente de la liste
        if (!this.sessions().some(x => x.id === this.sessionId())) {
          const actifId = this.contexte.sessionActiveId();
          const actif = s.find(x => x.id === actifId);
          this.sessionId.set((actif ?? this.sessionsTriees()[0] ?? null)?.id ?? null);
        }
      },
      error: (e: unknown) => {
        this.noterErreur(e, 'Les sessions n\'ont pas pu être chargées.');
        this.chargement.set(false);
      },
    });
  }

  selectionner(value: string): void {
    const id = Number(value);
    const s = this.sessions().find(x => x.id === id) ?? null;
    this.sessionId.set(s?.id ?? null);
    this.erreurAction.set('');
    this.messageAction.set('');
    if (s) this.contexte.definir(s.id, s.referencePPH, s.date);
  }

  telecharger(format: 'pdf' | 'excel'): void {
    const s = this.selection();
    if (!s) return;
    this.lancer(`registre-${format}` as Action);
    this.svc.telechargerRegistreDosage(s.id, format).subscribe({
      next: blob => this.livrer(blob, `registre-dosage-${s.id}.${format === 'excel' ? 'xlsx' : 'pdf'}`),
      error: (e: unknown) => this.echec(e, 'Le registre n\'a pas pu être téléchargé.'),
    });
  }

  telechargerZip(): void {
    const s = this.selection();
    if (!s) return;
    this.lancer('zip');
    this.svc.telechargerDocumentsDosage(s.id).subscribe({
      next: blob => this.livrer(blob, `documents-dosage-${s.id}.zip`),
      error: (e: unknown) => this.echec(e, 'Le pack de documents n\'a pas pu être téléchargé.'),
    });
  }

  /** Export CSV de la période : une ligne par session, puis les totaux de fûts et de matières. */
  exporterCsv(): void {
    if (this.debut() > this.fin()) {
      this.erreurAction.set('La date de début doit être antérieure à la date de fin.');
      return;
    }
    this.lancer('csv');
    forkJoin({
      sessions: this.svc.getSessionsDosageParPeriode(this.debut(), this.fin()),
      stats: this.svc.getStatistiquesFuts(this.debut(), this.fin()),
    }).subscribe({
      next: ({ sessions, stats }) => {
        this.livrer(this.construireCsv(sessions, stats), `sessions-dosage-${this.debut()}_${this.fin()}.csv`, true);
      },
      error: (e: unknown) => this.echec(e, 'L\'export CSV n\'a pas pu être généré.'),
    });
  }

  private construireCsv(sessions: SessionDosageBE[], stats: StatistiquesFutsBE): Blob {
    const lignes: (string | number)[][] = [
      ['Date', 'PPH', 'Agent', 'Statut', 'Fûts produits', 'Fûts cassés', 'Matières (kg)', 'Justification écart'],
      ...[...sessions]
        .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
        .map(s => [s.date, s.referencePPH, s.matriculeAgentDoseur, this.libelleStatut(s),
          s.nbFutsProduits, s.nbFutsCasses, this.sommeMatieres(s).toFixed(1), s.justificationEcart ?? '']),
    ];
    const totalMatieres = sessions.reduce((t, s) => t + this.sommeMatieres(s), 0);
    lignes.push([]);
    lignes.push(['Totaux de la période', '', '', '', stats.nbFutsProduits, '', totalMatieres.toFixed(1), '']);
    lignes.push(['Fûts nets (statistiques)', '', '', '', stats.nbFutsNets, '', '', '']);
    lignes.push(['Sessions non estimées (formule non identifiable)', '', '', '', stats.nbSessionsNonEstimees, '', '', '']);
    for (const m of stats.matieresPremieres) {
      lignes.push([`Matière : ${m.matierePremiere}`, '', '', '', '', '', m.quantiteKg.toFixed(1), '']);
    }
    const csv = lignes.map(l => l.map(cellule).join(';')).join('\n');
    return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  }

  private lancer(a: Action): void {
    this.action.set(a);
    this.erreurAction.set('');
    this.messageAction.set('');
  }

  private livrer(blob: Blob, nom: string, export_ = false): void {
    const url = window.URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    lien.click();
    window.URL.revokeObjectURL(url);
    this.action.set('');
    this.messageAction.set(export_ ? `Export téléchargé : ${nom}` : `Téléchargement lancé : ${nom}`);
  }

  private echec(e: unknown, repli: string): void {
    this.action.set('');
    this.noterErreur(e, repli, true);
  }

  private noterErreur(e: unknown, repli: string, versAction = false): void {
    if ((e as { status?: number })?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    if (versAction) this.erreurAction.set(repli);
    else this.erreur.set(repli);
  }
}
