import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductionService, ClassementExecuteurBE } from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Seuils de réalisation individuelle moyenne, en % (mêmes seuils que les autres pages de production). */
export const SEUIL_VIGILANCE = 50;
export const SEUIL_OBJECTIF_ATTEINT = 100;
export const SEUIL_DEPASSEMENT = 120;

export type Periode = 'semaine' | 'mois';
export type Niveau = 'bas' | 'moyen' | 'ok' | 'depasse';

/**
 * CLASSEMENT DES EMPLOYÉS — Responsable de Salle.
 * Classe les exécutants de la semaine ou du mois sur leur taux de réalisation individuel moyen : chaque production
 * est rapportée à l'objectif individuel du poste, ce qui permet de comparer des postes aux unités différentes.
 * Les quantités restent détaillées par unité.
 */
@Component({
  selector: 'app-rs-classement-employes',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './rs-classement-employes.component.html',
  styleUrls: ['./rs-classement-employes.component.css'],
})
export class RsClassementEmployesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = new Date();
  readonly seuilVigilance = SEUIL_VIGILANCE;
  readonly seuilAtteint = SEUIL_OBJECTIF_ATTEINT;
  readonly seuilDepassement = SEUIL_DEPASSEMENT;

  readonly periode = signal<Periode>('semaine');
  readonly chargementSemaine = signal(true);
  readonly chargementMois = signal(true);
  readonly semaine = signal<ClassementExecuteurBE[]>([]);
  readonly mois = signal<ClassementExecuteurBE[]>([]);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);

  readonly periodeLibelle = computed(() => this.periode() === 'semaine' ? 'Cette semaine' : 'Ce mois');
  readonly chargement = computed(() => this.periode() === 'semaine' ? this.chargementSemaine() : this.chargementMois());
  readonly classement = computed(() => this.periode() === 'semaine' ? this.semaine() : this.mois());
  readonly podium = computed(() => this.classement().slice(0, 3));
  readonly tauxEquipe = computed(() => {
    const c = this.classement();
    return c.length ? c.reduce((t, x) => t + x.tauxRealisationMoyen, 0) / c.length : null;
  });
  readonly meilleurTaux = computed(() => this.classement()[0]?.tauxRealisationMoyen ?? null);

  ngOnInit(): void {
    this.charger();
  }

  choisirPeriode(p: Periode): void {
    this.periode.set(p);
  }

  charger(): void {
    const fin = dateLocaleIso();
    this.erreur.set('');
    this.chargementSemaine.set(true);
    this.chargementMois.set(true);
    this.svc.getClassementExecuteurs(dateLocaleIso(this.debutSemaine()), fin).subscribe({
      next: c => { this.semaine.set(c); this.chargementSemaine.set(false); },
      error: (e: unknown) => { this.chargementSemaine.set(false); this.noterErreur(e, 'Le classement de la semaine n\'a pas pu être chargé.'); },
    });
    this.svc.getClassementExecuteurs(dateLocaleIso(this.debutMois()), fin).subscribe({
      next: c => { this.mois.set(c); this.chargementMois.set(false); },
      error: (e: unknown) => { this.chargementMois.set(false); this.noterErreur(e, 'Le classement du mois n\'a pas pu être chargé.'); },
    });
  }

  /** Lundi de la semaine en cours. */
  private debutSemaine(): Date {
    const d = new Date();
    const decalage = (d.getDay() + 6) % 7;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - decalage);
  }

  private debutMois(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  niveau(taux: number): Niveau {
    if (taux >= SEUIL_DEPASSEMENT) return 'depasse';
    if (taux >= SEUIL_OBJECTIF_ATTEINT) return 'ok';
    if (taux >= SEUIL_VIGILANCE) return 'moyen';
    return 'bas';
  }

  libelleNiveau(n: Niveau): string {
    return ({ bas: 'Sous le seuil', moyen: 'À surveiller', ok: 'Objectif atteint', depasse: 'Dépassement' } as const)[n];
  }

  medaille(rang: number): string {
    return rang === 1 ? '🥇' : rang === 2 ? '🥈' : rang === 3 ? '🥉' : '';
  }

  /** Borne un pourcentage entre 0 et 100 pour une barre. */
  borne(pct: number): number {
    return Math.max(0, Math.min(100, pct));
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
