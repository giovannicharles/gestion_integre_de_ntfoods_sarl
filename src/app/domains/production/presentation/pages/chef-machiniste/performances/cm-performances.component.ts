import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ProductionService, ClassementMachinisteBE, SessionBroyageBE,
} from '../../../../infrastructure/production.service';

type Periode = 'semaine' | 'mois' | 'personnalisee';
type Ligne = ClassementMachinisteBE['classements'][number];

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

/**
 * PERFORMANCES DES MACHINISTES — Chef Machiniste.
 *
 * Classement de la période (semaine ou mois en cours, ou dates libres) : production réalisée, objectif,
 * efficacité, taux de réalisation moyen, postes et jours travaillés. Un machiniste se déploie pour voir
 * son réalisé jour par jour.
 *
 * Définitions reprises du backend (ClassementMachinistesUseCase) :
 * - efficacité = réalisé total ÷ objectif total (le backend renvoie un ratio : affiché en %) ;
 * - taux de réalisation moyen = moyenne non pondérée des pourcentages par ligne ;
 * - classement : efficacité décroissante, puis production décroissante.
 */
@Component({
  selector: 'app-cm-performances',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cm-performances.component.html',
  styleUrls: ['./cm-performances.component.css'],
})
export class CmPerformancesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();

  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);
  readonly classement = signal<ClassementMachinisteBE | null>(null);

  readonly periode = signal<Periode>('semaine');
  readonly debut = signal(this.debutSemaine());
  readonly fin = signal(this.aujourdhui);
  readonly dateInvalide = computed(() => this.debut() > this.fin());
  readonly recherche = signal('');

  readonly ouvert = signal<string | null>(null);
  readonly detail = signal<{ date: string; objectifKg: number; realiseKg: number }[]>([]);
  readonly chargementDetail = signal(false);
  readonly erreurDetail = signal('');

  readonly lignes = computed<Ligne[]>(() => {
    const r = this.recherche().trim().toLowerCase();
    const list = this.classement()?.classements ?? [];
    return r
      ? list.filter(c => c.nomMachiniste.toLowerCase().includes(r) || c.machinisteMatricule.toLowerCase().includes(r))
      : list;
  });

  readonly productionTotale = computed(() => this.lignes().reduce((t, c) => t + c.productiviteKg, 0));
  readonly objectifTotal = computed(() => this.lignes().reduce((t, c) => t + c.objectifTotalKg, 0));
  readonly efficaciteGlobale = computed(() =>
    this.objectifTotal() > 0 ? Math.round((this.productionTotale() / this.objectifTotal()) * 1000) / 10 : 0);
  readonly meilleur = computed(() => this.classement()?.classements[0] ?? null);

  readonly periodes: { code: Periode; libelle: string }[] = [
    { code: 'semaine', libelle: 'Semaine' },
    { code: 'mois', libelle: 'Mois' },
  ];

  ngOnInit(): void {
    this.charger();
  }

  choisirPeriode(p: Periode): void {
    this.periode.set(p);
    this.fin.set(this.aujourdhui);
    this.debut.set(p === 'mois' ? this.debutMois() : this.debutSemaine());
    this.charger();
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
    this.ouvert.set(null);
    this.svc.getClassementMachinistes(this.debut(), this.fin()).subscribe({
      next: c => {
        this.classement.set(c);
        this.derniereMaj.set(new Date());
        this.chargement.set(false);
      },
      error: (e: unknown) => {
        this.chargement.set(false);
        this.noterErreur(e, 'Les performances n\'ont pas pu être chargées.');
      },
    });
  }

  /** Efficacité en pourcentage (le backend renvoie un ratio, plafonné à 200 %). */
  efficacitePct(c: Ligne): number {
    return Math.round(c.efficacite * 1000) / 10;
  }

  basculer(matricule: string): void {
    if (this.ouvert() === matricule) { this.ouvert.set(null); return; }
    this.ouvert.set(matricule);
    this.chargerDetail(matricule);
  }

  /** Réalisé de ce machiniste jour par jour, depuis les sessions de la période. */
  private chargerDetail(matricule: string): void {
    this.chargementDetail.set(true);
    this.erreurDetail.set('');
    this.detail.set([]);
    this.svc.getPerformancesMachiniste(matricule, this.debut(), this.fin()).subscribe({
      next: sessions => {
        this.detail.set(this.parJour(matricule, sessions));
        this.chargementDetail.set(false);
      },
      error: (e: unknown) => {
        this.chargementDetail.set(false);
        this.noterErreur(e, 'Le détail de ce machiniste n\'a pas pu être chargé.', true);
      },
    });
  }

  private parJour(matricule: string, sessions: SessionBroyageBE[]): { date: string; objectifKg: number; realiseKg: number }[] {
    return sessions
      .map(s => {
        const mine = s.realisations.filter(r => r.machinisteMatricule === matricule);
        return {
          date: s.date,
          objectifKg: mine.reduce((t, r) => t + r.objectifKg, 0),
          realiseKg: mine.reduce((t, r) => t + r.realiseKg, 0),
        };
      })
      .filter(j => j.objectifKg > 0 || j.realiseKg > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  exporterCsv(): void {
    const entetes = ['Rang', 'Matricule', 'Nom', 'Postes', 'Production (kg)', 'Objectif (kg)', 'Efficacité (%)', 'Taux moyen (%)', 'Jours'];
    const lignes = this.lignes().map(c => [
      c.rang, c.machinisteMatricule, c.nomMachiniste, c.operations.join(' / '),
      c.productiviteKg.toFixed(1), c.objectifTotalKg.toFixed(1), this.efficacitePct(c).toFixed(1),
      c.tauxRealisationMoyen.toFixed(1), c.nbJours,
    ]);
    const csv = [entetes, ...lignes].map(r => r.map(v => (String(v).includes(';') ? `"${v}"` : v)).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `performances-machinistes-${this.debut()}_${this.fin()}.csv`;
    lien.click();
    window.URL.revokeObjectURL(url);
  }

  private noterErreur(e: unknown, repli: string, versDetail = false): void {
    const err = e as { status?: number; error?: { erreur?: string; message?: string } };
    if (err?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    const message = err?.error?.erreur || err?.error?.message || repli;
    if (versDetail) this.erreurDetail.set(message);
    else this.erreur.set(message);
  }

  private debutSemaine(): string {
    const decalage = (new Date().getDay() + 6) % 7; // lundi = 0
    return ajouterJours(this.aujourdhui, -decalage);
  }

  private debutMois(): string {
    const d = new Date();
    return dateLocaleIso(new Date(d.getFullYear(), d.getMonth(), 1));
  }
}
