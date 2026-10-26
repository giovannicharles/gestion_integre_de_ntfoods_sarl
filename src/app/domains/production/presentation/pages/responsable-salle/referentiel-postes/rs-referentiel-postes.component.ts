import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, CodePosteRef } from '../../../../infrastructure/production.service';

/** Libellé lisible d'une catégorie métier (TANTY_BOUILLIE_DE_SOJA → Bouillie de soja). */
function libelleCategorie(code: string): string {
  const texte = code.replace(/^TANTY_/, '').replace(/_/g, ' ').toLowerCase();
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Texte normalisé pour la recherche : minuscules et sans accents. */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Au-delà de ce nombre d'heures, une base journalière est jugée incohérente avec la cadence horaire. */
const HEURES_MAX_PLAUSIBLES = 12;

/** Un poste enrichi des indicateurs calculés pour l'affichage. */
interface LignePoste {
  poste: CodePosteRef;
  categories: string[];
  /** Production par heure et par personne de l'effectif de référence (même unité que la production). */
  rendement: number;
  /** Heures de base implicites : production journalière divisée par la production horaire. */
  heuresJour: number;
  /** Motif d'anomalie ; vide si le poste est cohérent. */
  anomalie: string;
}

/**
 * RÉFÉRENTIEL DES POSTES — Responsable de Salle.
 * Lecture seule des postes de production actifs, source de tous les calculs d'affectation et d'objectifs.
 * La modification se fait dans Administration > Postes production. Les productions ne sont pas additionnées
 * entre postes : chacun a sa propre unité.
 */
@Component({
  selector: 'app-rs-referentiel-postes',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-referentiel-postes.component.html',
  styleUrls: ['./rs-referentiel-postes.component.css'],
})
export class RsReferentielPostesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly postes = signal<CodePosteRef[]>([]);

  readonly recherche = signal('');
  readonly categorieChoisie = signal('');

  readonly categories = computed(() => {
    const codes = new Set(this.postes().flatMap(p => p.categoriesMetier ?? []));
    return [...codes].sort().map(code => ({ code, libelle: libelleCategorie(code) }));
  });

  /** Postes triés selon l'ordre de la chaîne de production, avec leurs indicateurs. */
  readonly lignes = computed<LignePoste[]>(() => this.postes()
    .slice()
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.libelle.localeCompare(b.libelle, 'fr'))
    .map(p => this.calculer(p)));

  readonly lignesFiltrees = computed(() => {
    const motif = normaliser(this.recherche());
    const categorie = this.categorieChoisie();
    return this.lignes().filter(l =>
      (!categorie || l.categories.includes(categorie))
      && (!motif || normaliser(`${l.poste.libelle} ${l.poste.code} ${l.poste.unite}`).includes(motif)));
  });

  readonly effectifTotal = computed(() => this.postes().reduce((t, p) => t + (p.effectifReference || 0), 0));
  readonly nbUnites = computed(() => new Set(this.postes().map(p => p.unite)).size);
  readonly nbAnomalies = computed(() => this.lignes().filter(l => l.anomalie).length);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getPostesProduction().subscribe({
      next: list => { this.postes.set(list); this.chargement.set(false); },
      error: (e: unknown) => { this.chargement.set(false); this.noterErreur(e); },
    });
  }

  libelle(code: string): string {
    return libelleCategorie(code);
  }

  choisirCategorie(code: string): void {
    this.categorieChoisie.set(this.categorieChoisie() === code ? '' : code);
  }

  reinitialiserFiltres(): void {
    this.recherche.set('');
    this.categorieChoisie.set('');
  }

  private calculer(p: CodePosteRef): LignePoste {
    const rendement = p.effectifReference > 0 ? p.productionParHeure / p.effectifReference : 0;
    const heuresJour = p.productionParHeure > 0 ? p.productionJournaliere / p.productionParHeure : 0;
    let anomalie = '';
    if (p.effectifReference <= 0) {
      anomalie = 'Effectif de référence nul : les objectifs de ce poste ne peuvent pas être calculés.';
    } else if (p.productionParHeure <= 0 || p.productionJournaliere <= 0) {
      anomalie = 'Production horaire ou journalière non renseignée.';
    } else if (heuresJour > HEURES_MAX_PLAUSIBLES) {
      anomalie = `La production journalière équivaut à ${Math.round(heuresJour)} h de production horaire : valeurs à vérifier.`;
    }
    return { poste: p, categories: p.categoriesMetier ?? [], rendement, heuresJour, anomalie };
  }

  private noterErreur(e: unknown): void {
    const err = e as { status?: number; error?: { erreur?: string; message?: string } };
    if (err?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    // Pas de liste de repli : une erreur doit rester visible, sinon des valeurs anciennes passeraient pour la référence
    this.erreur.set(err?.error?.erreur || err?.error?.message || 'Le référentiel des postes n\'a pas pu être chargé.');
  }
}
