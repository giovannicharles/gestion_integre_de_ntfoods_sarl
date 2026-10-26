import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ProductionService, SessionBroyageBE, ClassementMachinisteBE,
} from '../../../../infrastructure/production.service';

type Rapport = 'journalier' | 'hebdomadaire' | 'mensuel' | 'pertes' | 'performances' | 'objectifs' | 'realisations';
type Periode = 'jour' | 'semaine' | 'mois' | 'personnalisee';
type Cellule = string | number;

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

/** Échappe une valeur avant de l'insérer dans le HTML d'impression. */
function echapper(v: Cellule): string {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Contenu d'un rapport : colonnes, lignes, et ligne de total facultative. */
interface Contenu {
  titre: string;
  colonnes: string[];
  lignes: Cellule[][];
  total?: Cellule[];
  vide: string;
}

/**
 * RAPPORTS — Chef Machiniste.
 *
 * Les endpoints `/production/rapports/*` exigent STOCK_RAPPORT_CONSULTER, que ce rôle n'a pas : les rapports
 * sont donc construits ici à partir des données de broyage auxquelles il a accès (sessions, réalisations,
 * classement). Chaque rapport est affiché en aperçu, et ses exports CSV et PDF reprennent exactement ce même
 * contenu.
 */
@Component({
  selector: 'app-cm-rapports',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cm-rapports.component.html',
  styleUrls: ['./cm-rapports.component.css'],
})
export class CmRapportsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);
  readonly export = signal<string>('');

  readonly periode = signal<Periode>('semaine');
  readonly debut = signal(this.debutSemaine());
  readonly fin = signal(this.aujourdhui);
  readonly dateInvalide = computed(() => this.debut() > this.fin());

  readonly sessions = signal<SessionBroyageBE[]>([]);
  readonly classement = signal<ClassementMachinisteBE | null>(null);
  readonly rapportChoisi = signal<Rapport>('hebdomadaire');

  readonly periodes: { code: Periode; libelle: string }[] = [
    { code: 'jour', libelle: 'Aujourd\'hui' },
    { code: 'semaine', libelle: 'Semaine' },
    { code: 'mois', libelle: 'Mois' },
  ];

  readonly rapports: { code: Rapport; titre: string; description: string; icone: string; periodeImposee?: string }[] = [
    { code: 'journalier', titre: 'Production journalière', description: 'Chaque session du jour, avec son objectif, son réalisé et ses pertes.', icone: 'fa-calendar-day', periodeImposee: 'jour' },
    { code: 'hebdomadaire', titre: 'Production hebdomadaire', description: 'Totaux par jour sur la période, avec le total général.', icone: 'fa-calendar-week' },
    { code: 'mensuel', titre: 'Production mensuelle', description: 'Totaux par semaine sur le mois en cours.', icone: 'fa-calendar-days', periodeImposee: 'mois' },
    { code: 'pertes', titre: 'Rapport des pertes', description: 'Pertes et % de pertes par session, avec le total.', icone: 'fa-triangle-exclamation' },
    { code: 'performances', titre: 'Rapport des performances', description: 'Classement des machinistes sur la période.', icone: 'fa-chart-simple' },
    { code: 'objectifs', titre: 'Rapport des objectifs', description: 'Objectif de chaque machiniste par session et par poste.', icone: 'fa-bullseye' },
    { code: 'realisations', titre: 'Rapport des réalisations', description: 'Réalisé de chaque machiniste par session et par poste.', icone: 'fa-list-check' },
  ];

  /** Contenu du rapport choisi, calculé une fois à partir des données chargées : aperçu et exports en sont issus. */
  readonly contenu = computed<Contenu>(() => this.construire(this.rapportChoisi(), this.sessions(), this.classement()));

  readonly nbLignes = computed(() => this.contenu().lignes.length);

  ngOnInit(): void {
    this.charger();
  }

  choisirPeriode(p: Periode): void {
    this.periode.set(p);
    this.fin.set(this.aujourdhui);
    this.debut.set(p === 'jour' ? this.aujourdhui : p === 'mois' ? this.debutMois() : this.debutSemaine());
    this.charger();
  }

  /** Choisir un rapport : sa période est imposée si elle est propre au rapport (jour, mois). */
  choisirRapport(r: { code: Rapport; periodeImposee?: string }): void {
    this.rapportChoisi.set(r.code);
    if (r.periodeImposee) {
      const p = r.periodeImposee as Periode;
      this.choisirPeriode(p);
    }
  }

  appliquerPersonnalisee(): void {
    if (this.dateInvalide()) return;
    this.periode.set('personnalisee');
    this.charger();
  }

  charger(): void {
    if (this.dateInvalide()) return;
    this.chargement.set(true);
    this.erreur.set('');
    forkJoin({
      sessions: this.svc.getSessionsBroyage({ debut: this.debut(), fin: this.fin() }),
      classement: this.svc.getClassementMachinistes(this.debut(), this.fin()),
    }).subscribe({
      next: r => {
        this.sessions.set(r.sessions);
        this.classement.set(r.classement);
        this.derniereMaj.set(new Date());
        this.chargement.set(false);
      },
      error: (e: unknown) => {
        this.chargement.set(false);
        const err = e as { status?: number; error?: { erreur?: string; message?: string } };
        if (err?.status === 401) {
          this.sessionExpiree.set(true);
          this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
        } else {
          this.erreur.set(err?.error?.erreur || err?.error?.message || 'Les données du rapport n\'ont pas pu être chargées.');
        }
      },
    });
  }

  exporterCsv(): void {
    const c = this.contenu();
    const toutes = c.total ? [...c.lignes, c.total] : c.lignes;
    const csv = [c.colonnes, ...toutes].map(l => l.map(v => this.csvCellule(v)).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    this.telecharger(blob, `rapport-${this.rapportChoisi()}-${this.debut()}_${this.fin()}.csv`);
  }

  imprimer(): void {
    const w = window.open('', '_blank');
    if (!w) { this.erreur.set('Autorisez les pop-ups pour imprimer ou enregistrer le rapport en PDF.'); return; }
    const c = this.contenu();
    const toutes = c.total ? [...c.lignes, c.total] : c.lignes;
    const th = c.colonnes.map(x => `<th>${echapper(x)}</th>`).join('');
    const corps = toutes.map((l, i) => `<tr${c.total && i === toutes.length - 1 ? ' class="total"' : ''}>${
      l.map(v => `<td>${echapper(v)}</td>`).join('')}</tr>`).join('');
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(c.titre)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 4px} p{margin:0 0 12px;color:#555;font-size:12px}
        table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #ccc;padding:6px;text-align:left}
        th{background:#f3f4f6} tr.total td{font-weight:bold;background:#f9fafb}
      </style></head><body>
      <h1>${echapper(c.titre)}</h1>
      <p>Période : ${echapper(this.debut())} au ${echapper(this.fin())}</p>
      ${c.lignes.length ? `<table><thead><tr>${th}</tr></thead><tbody>${corps}</tbody></table>` : `<p>${echapper(c.vide)}</p>`}
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  private construire(r: Rapport, sessions: SessionBroyageBE[], classement: ClassementMachinisteBE | null): Contenu {
    const titre = this.rapports.find(x => x.code === r)?.titre ?? r;
    const trie = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const netteOuRealise = (s: SessionBroyageBE) => s.quantiteNetteBroyeeKg ?? s.totalRealiseKg;
    const pct = (p: number | null | undefined) => (p == null ? '—' : Math.round(p * 10) / 10);

    switch (r) {
      case 'journalier':
        return {
          titre, vide: 'Aucune session de broyage ce jour.',
          colonnes: ['Date', 'PPH', 'Poudre', 'Objectif (kg)', 'Réalisé (kg)', 'Nette (kg)', 'Pertes (kg)', '% pertes', 'Validation', 'Statut'],
          lignes: trie.map(s => [s.date, s.referencePPH, s.typePoudreLibelle, s.objectifJournalierKg, s.totalRealiseKg,
            s.quantiteNetteBroyeeKg ?? '—', s.pertesKg ?? '—', pct(s.pctPertes), s.journeeValidee ? 'Validée' : 'Non validée',
            s.statut === 'CLOTUREE' ? 'Clôturée' : 'Ouverte']),
        };

      case 'hebdomadaire':
      case 'mensuel': {
        // Totaux par jour (hebdomadaire) ou par semaine civile (mensuel)
        const cle = (d: string) => r === 'mensuel' ? this.debutSemaineDe(d) : d;
        const groupes = new Map<string, SessionBroyageBE[]>();
        for (const s of trie) {
          const k = cle(s.date);
          groupes.set(k, [...(groupes.get(k) ?? []), s]);
        }
        const lignes: Cellule[][] = [...groupes.entries()].map(([k, ss]) => this.ligneAgregee(k, ss));
        const total = this.ligneAgregee('Total', trie);
        return {
          titre: r === 'mensuel' ? titre + ' (par semaine)' : titre,
          vide: 'Aucune session de broyage sur cette période.',
          colonnes: [r === 'mensuel' ? 'Semaine du' : 'Date', 'Sessions', 'Objectif (kg)', 'Réalisé (kg)', 'Taux (%)', 'Pertes (kg)', '% pertes'],
          lignes, total: total.slice(0, 7),
        };
      }

      case 'pertes': {
        const totalPertes = trie.reduce((t, s) => t + (s.pertesKg ?? 0), 0);
        return {
          titre, vide: 'Aucune session de broyage sur cette période.',
          colonnes: ['Date', 'PPH', 'Poudre', 'Nette (kg)', 'Pertes (kg)', '% pertes'],
          lignes: trie.map(s => [s.date, s.referencePPH, s.typePoudreLibelle, s.quantiteNetteBroyeeKg ?? '—',
            s.pertesKg ?? '—', pct(s.pctPertes)]),
          total: ['Total', '', '', '', Math.round(totalPertes * 10) / 10, ''],
        };
      }

      case 'performances':
        return {
          titre, vide: 'Aucune réalisation sur cette période.',
          colonnes: ['Rang', 'Machiniste', 'Postes', 'Production (kg)', 'Objectif (kg)', 'Efficacité (%)', 'Taux moyen (%)', 'Jours'],
          lignes: (classement?.classements ?? []).map(c => [c.rang, c.nomMachiniste, c.operations.join(' / '),
            c.productiviteKg, c.objectifTotalKg, Math.round(c.efficacite * 1000) / 10, pct(c.tauxRealisationMoyen), c.nbJours]),
        };

      case 'objectifs':
        return {
          titre, vide: 'Aucun objectif de machiniste sur cette période.',
          colonnes: ['Date', 'PPH', 'Poudre', 'Machiniste', 'Poste', 'Objectif (kg)'],
          lignes: trie.flatMap(s => s.objectifsMachinistes.map(o => [s.date, s.referencePPH, s.typePoudreLibelle,
            o.nomMachiniste, o.operationLibelle, o.objectifKg])),
        };

      case 'realisations':
        return {
          titre, vide: 'Aucune réalisation saisie sur cette période.',
          colonnes: ['Date', 'PPH', 'Poudre', 'Machiniste', 'Poste', 'Objectif (kg)', 'Réalisé (kg)', '% réalisation'],
          lignes: trie.flatMap(s => s.realisations.map(x => [s.date, s.referencePPH, s.typePoudreLibelle,
            x.nomMachiniste, x.operationLibelle, x.objectifKg, x.realiseKg, pct(x.pctRealisation)])),
        };
    }
  }

  /** Ligne agrégée : sessions, objectif, réalisé, taux, pertes et % de pertes. */
  private ligneAgregee(libelle: string, ss: SessionBroyageBE[]): Cellule[] {
    const objectif = ss.reduce((t, s) => t + s.objectifJournalierKg, 0);
    const realise = ss.reduce((t, s) => t + s.totalRealiseKg, 0);
    const pertes = ss.reduce((t, s) => t + (s.pertesKg ?? 0), 0);
    const netteAvecPertes = ss.filter(s => s.pertesKg != null).reduce((t, s) => t + (s.quantiteNetteBroyeeKg ?? 0), 0);
    const brut = netteAvecPertes + pertes;
    const r1 = (x: number) => Math.round(x * 10) / 10;
    return [libelle, ss.length, r1(objectif), r1(realise), objectif > 0 ? r1((realise / objectif) * 100) : '—',
      r1(pertes), brut > 0 ? r1((pertes / brut) * 100) : '—'];
  }

  estNombre(v: Cellule): boolean {
    return typeof v === 'number';
  }

  private csvCellule(v: Cellule): string {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  private telecharger(blob: Blob, nom: string): void {
    const url = window.URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    lien.click();
    window.URL.revokeObjectURL(url);
  }

  private debutSemaine(): string {
    return this.debutSemaineDe(this.aujourdhui);
  }

  /** Lundi de la semaine contenant la date donnée. */
  private debutSemaineDe(iso: string): string {
    const [y, m, j] = iso.split('-').map(Number);
    const jour = new Date(y, m - 1, j).getDay();
    return ajouterJours(iso, -((jour + 6) % 7));
  }

  private debutMois(): string {
    const d = new Date();
    return dateLocaleIso(new Date(d.getFullYear(), d.getMonth(), 1));
  }
}
