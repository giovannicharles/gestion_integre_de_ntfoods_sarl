import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, SessionBroyageBE } from '../../../../infrastructure/production.service';

type Periode = 'aujourdhui' | 'semaine' | 'mois' | 'personnalisee';
type Validation = 'TOUTES' | 'VALIDEES' | 'NON_VALIDEES';

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
 * SUIVI DES RÉALISATIONS — Chef Machiniste.
 * Consultation des sessions de broyage par période calendaire (aujourd'hui, semaine en cours, mois en
 * cours, ou dates libres) : objectif, réalisé, taux, validation de journée, et détail des réalisations
 * par machiniste et par poste.
 *
 * Le taux et la validation suivent le backend : le réalisé (somme des machinistes) est comparé à
 * l'objectif journalier, et la journée est validée à 85 % ou avec une justification.
 */
@Component({
  selector: 'app-cm-suivi',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cm-suivi.component.html',
  styleUrls: ['./cm-suivi.component.css'],
})
export class CmSuiviComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();

  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);
  readonly sessions = signal<SessionBroyageBE[]>([]);

  readonly periode = signal<Periode>('semaine');
  readonly debut = signal(this.debutSemaine());
  readonly fin = signal(this.aujourdhui);
  readonly dateInvalide = computed(() => this.debut() > this.fin());

  readonly recherche = signal('');
  readonly validation = signal<Validation>('TOUTES');
  readonly ouverte = signal<number | null>(null);

  readonly filtrees = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    const v = this.validation();
    return this.sessions()
      .filter(s => !r || s.referencePPH.toLowerCase().includes(r) || s.typePoudreLibelle.toLowerCase().includes(r))
      .filter(s => v === 'TOUTES' || (v === 'VALIDEES' ? s.journeeValidee : !s.journeeValidee))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  });

  readonly objectifTotal = computed(() => this.filtrees().reduce((t, s) => t + s.objectifJournalierKg, 0));
  readonly realiseTotal = computed(() => this.filtrees().reduce((t, s) => t + s.totalRealiseKg, 0));
  readonly tauxGlobal = computed(() => this.objectifTotal() > 0
    ? Math.round((this.realiseTotal() / this.objectifTotal()) * 1000) / 10 : 0);
  readonly nbValidees = computed(() => this.filtrees().filter(s => s.journeeValidee).length);
  readonly nbClotures = computed(() => this.filtrees().filter(s => s.statut === 'CLOTUREE').length);

  readonly periodes: { code: Periode; libelle: string }[] = [
    { code: 'aujourdhui', libelle: 'Aujourd\'hui' },
    { code: 'semaine', libelle: 'Semaine' },
    { code: 'mois', libelle: 'Mois' },
  ];

  ngOnInit(): void {
    this.choisirPeriode('semaine');
  }

  choisirPeriode(p: Periode): void {
    this.periode.set(p);
    if (p === 'aujourdhui') { this.debut.set(this.aujourdhui); this.fin.set(this.aujourdhui); }
    if (p === 'semaine') { this.debut.set(this.debutSemaine()); this.fin.set(this.aujourdhui); }
    if (p === 'mois') { this.debut.set(this.debutMois()); this.fin.set(this.aujourdhui); }
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
    this.svc.getSessionsBroyage({ debut: this.debut(), fin: this.fin() }).subscribe({
      next: list => {
        this.sessions.set(list);
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
          this.erreur.set(err?.error?.erreur || err?.error?.message || 'Les réalisations n\'ont pas pu être chargées.');
        }
      },
    });
  }

  /** Taux de réalisation de la journée : réalisé (somme des machinistes) sur objectif journalier. */
  taux(s: SessionBroyageBE): number {
    return s.objectifJournalierKg > 0 ? Math.round((s.totalRealiseKg / s.objectifJournalierKg) * 1000) / 10 : 0;
  }

  basculer(id: number): void {
    this.ouverte.set(this.ouverte() === id ? null : id);
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
