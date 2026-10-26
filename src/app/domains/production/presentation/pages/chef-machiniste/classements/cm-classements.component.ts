import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductionService, ClassementMachinisteBE } from '../../../../infrastructure/production.service';

type Critere = 'productivite' | 'efficacite' | 'taux';
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

/** Un classement de période, prêt à l'affichage : rangs recalculés selon le critère choisi. */
interface Periode {
  titre: string;
  libelle: string;
  lignes: Ligne[];
  chargement: boolean;
  erreur: string;
}

/**
 * CLASSEMENTS — Chef Machiniste.
 * Classement de la semaine en cours et du mois en cours, selon la productivité, l'efficacité ou le taux
 * de réalisation moyen.
 *
 * Définitions reprises du backend (ClassementMachinistesUseCase) :
 * - productivité = réalisé total (kg) ;
 * - efficacité = réalisé ÷ objectif, renvoyée en ratio : affichée en % ;
 * - taux de réalisation moyen = moyenne simple des pourcentages par poste.
 */
@Component({
  selector: 'app-cm-classements',
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink],
  templateUrl: './cm-classements.component.html',
  styleUrls: ['./cm-classements.component.css'],
})
export class CmClassementsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);
  readonly critere = signal<Critere>('productivite');

  readonly criteres: { code: Critere; libelle: string; unite: string }[] = [
    { code: 'productivite', libelle: 'Production', unite: 'kg' },
    { code: 'efficacite', libelle: 'Efficacité', unite: '%' },
    { code: 'taux', libelle: 'Taux moyen', unite: '%' },
  ];

  readonly semaine = signal<Periode>({ titre: 'Semaine en cours', libelle: '', lignes: [], chargement: true, erreur: '' });
  readonly mois = signal<Periode>({ titre: 'Mois en cours', libelle: '', lignes: [], chargement: true, erreur: '' });

  readonly unite = computed(() => this.criteres.find(c => c.code === this.critere())?.unite ?? '');

  /** Podium : les trois premiers de la semaine (ou du mois si la semaine est vide). */
  readonly podium = computed(() => (this.semaine().lignes.length ? this.semaine() : this.mois()).lignes.slice(0, 3));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    const debutSemaine = this.debutSemaine();
    const debutMois = this.debutMois();
    this.chargerPeriode(this.semaine, debutSemaine, 'Du ' + this.libelleJour(debutSemaine) + ' à aujourd\'hui');
    this.chargerPeriode(this.mois, debutMois, 'Du ' + this.libelleJour(debutMois) + ' à aujourd\'hui');
  }

  changerCritere(c: Critere): void {
    this.critere.set(c);
    this.semaine.update(p => ({ ...p, lignes: this.classer(p.lignes) }));
    this.mois.update(p => ({ ...p, lignes: this.classer(p.lignes) }));
  }

  /** Valeur d'une ligne selon le critère, en unité affichable (efficacité convertie en %). */
  valeur(l: Ligne): number {
    switch (this.critere()) {
      case 'productivite': return l.productiviteKg;
      case 'efficacite': return Math.round(l.efficacite * 1000) / 10;
      default: return l.tauxRealisationMoyen;
    }
  }

  /** Largeur de barre : la valeur plafonnée à 100 % (la production en kg est proportionnée au meilleur). */
  largeur(l: Ligne, lignes: Ligne[]): number {
    if (this.critere() === 'productivite') {
      const max = Math.max(...lignes.map(x => x.productiviteKg), 0);
      return max > 0 ? (l.productiviteKg / max) * 100 : 0;
    }
    return Math.min(100, this.valeur(l));
  }

  medaille(rang: number): string {
    return rang === 1 ? '🥇' : rang === 2 ? '🥈' : rang === 3 ? '🥉' : '';
  }

  private chargerPeriode(cible: { set: (p: Periode) => void; update: (f: (p: Periode) => Periode) => void }, debut: string, libelle: string): void {
    cible.update(p => ({ ...p, libelle, chargement: true, erreur: '' }));
    this.svc.getClassementMachinistes(debut, this.aujourdhui).subscribe({
      next: c => {
        cible.update(p => ({ ...p, lignes: this.classer(c.classements), chargement: false }));
        this.derniereMaj.set(new Date());
      },
      error: (e: unknown) => {
        const err = e as { status?: number; error?: { erreur?: string; message?: string } };
        if (err?.status === 401) {
          this.sessionExpiree.set(true);
          cible.update(p => ({ ...p, chargement: false, erreur: 'Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.' }));
          return;
        }
        cible.update(p => ({ ...p, chargement: false, erreur: err?.error?.erreur || err?.error?.message || 'Le classement n\'a pas pu être chargé.' }));
      },
    });
  }

  /** Trie selon le critère choisi (décroissant) et recalcule les rangs. */
  private classer(lignes: Ligne[]): Ligne[] {
    const valeur = (l: Ligne) => this.critere() === 'productivite' ? l.productiviteKg
      : this.critere() === 'efficacite' ? l.efficacite : l.tauxRealisationMoyen;
    return [...lignes]
      .sort((a, b) => valeur(b) - valeur(a) || b.productiviteKg - a.productiviteKg)
      .map((l, i) => ({ ...l, rang: i + 1 }));
  }

  private libelleJour(iso: string): string {
    const [y, m, j] = iso.split('-').map(Number);
    return new Date(y, m - 1, j).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  private debutSemaine(): string {
    const decalage = (new Date().getDay() + 6) % 7; // lundi = 0
    return ajouterJours(this.aujourdhui, -decalage);
  }

  private debutMois(): string {
    const d = new Date();
    return dateLocaleIso(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  /** Libellé du critère courant, en minuscules (« Classé par … »). */
  readonly libelleCritere = computed(() => this.criteres.find(c => c.code === this.critere())?.libelle?.toLowerCase() ?? '');
}
