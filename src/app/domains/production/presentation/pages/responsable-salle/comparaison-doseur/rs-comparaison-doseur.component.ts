import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, PPHBE, ComparaisonBCBE } from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Libellé lisible d'une catégorie métier (TANTY_BOUILLIE_DE_SOJA → Bouillie de soja). */
function libelleCategorie(code: string): string {
  const texte = code.replace(/^TANTY_/, '').replace(/_/g, ' ').toLowerCase();
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Écart au-delà duquel une comparaison est signalée (en % de la valeur théorique). */
export const SEUIL_ECART_PCT = 15;

/** Catégorie suivie en priorité : la bouillie de soja, dont la matière principale est le soja. */
const CATEGORIE_PRIORITAIRE = 'TANTY_BOUILLIE_DE_SOJA';

/**
 * COMPARAISON DOSEUR / PRODUCTION — Responsable de Salle.
 * Pour une journée, compare le plan issu du bon de commande (produits, formules, fûts prévus) avec ce que
 * l'agent doseur a réellement dosé et ce qui a été réalisé sur les postes. Les quantités restent dans leur unité :
 * sachets, sceaux, étiquettes et kg ne sont pas additionnés entre eux.
 */
@Component({
  selector: 'app-rs-comparaison-doseur',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-comparaison-doseur.component.html',
  styleUrls: ['./rs-comparaison-doseur.component.css'],
})
export class RsComparaisonDoseurComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly seuil = SEUIL_ECART_PCT;
  readonly categoriePrioritaire = CATEGORIE_PRIORITAIRE;

  readonly chargement = signal(true);
  readonly chargementComparaison = signal(false);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);

  readonly pphs = signal<PPHBE[]>([]);
  readonly referenceChoisie = signal('');
  readonly dateChoisie = signal(dateLocaleIso());
  readonly comparaison = signal<ComparaisonBCBE | null>(null);

  /** Produits du BC regroupés par catégorie ; la bouillie est toujours en tête. */
  readonly groupesProduits = computed(() => {
    const c = this.comparaison();
    if (!c) return [];
    const par = new Map<string, ComparaisonBCBE['produits']>();
    c.produits.forEach(p => par.set(p.categorie, [...(par.get(p.categorie) ?? []), p]));
    return [...par.entries()]
      .sort(([a], [b]) => (a === CATEGORIE_PRIORITAIRE ? -1 : b === CATEGORIE_PRIORITAIRE ? 1 : a.localeCompare(b)))
      .map(([categorie, produits]) => ({ categorie, libelle: libelleCategorie(categorie), produits }));
  });

  /** Matières dosées contre formules, en kg. */
  readonly matieres = computed(() => this.comparaison()?.matieres ?? []);

  /** Soja du jour : la bouillie est sa principale consommatrice. */
  readonly soja = computed(() => this.matieres().find(m => m.matiere === 'SOJA') ?? null);
  readonly sojaBouillie = computed(() =>
    this.soja()?.theoriqueParCategorie.find(p => p.categorie === CATEGORIE_PRIORITAIRE)?.theoriqueKg ?? 0);
  readonly produitsBouillie = computed(() =>
    this.groupesProduits().find(g => g.categorie === CATEGORIE_PRIORITAIRE)?.produits ?? []);

  readonly alertes = computed(() => {
    const c = this.comparaison();
    if (!c) return [];
    const msgs: string[] = [];
    if (c.futs.futsPrevus > 0 && Math.abs(c.futs.ecartPct) > SEUIL_ECART_PCT) {
      msgs.push(`Fûts : ${c.futs.futsNetsDoses} dosés pour ${c.futs.futsPrevus.toFixed(1)} prévus (${c.futs.ecartPct > 0 ? '+' : ''}${c.futs.ecartPct.toFixed(1)} %).`);
    }
    c.matieres.filter(m => m.theoriqueKg > 0 && Math.abs(m.ecartPct) > SEUIL_ECART_PCT).forEach(m =>
      msgs.push(`${m.matiere} : ${m.doseeKg.toFixed(1)} kg dosés pour ${m.theoriqueKg.toFixed(1)} kg prévus (${m.ecartPct > 0 ? '+' : ''}${m.ecartPct.toFixed(1)} %).`));
    if (c.matieres.some(m => m.theoriqueKg === 0 && m.doseeKg > 0)) {
      msgs.push('Matière dosée sans besoin prévu au plan du jour : vérifier les sessions.');
    }
    return msgs;
  });

  ngOnInit(): void {
    this.svc.getPPHs('EN_COURS').subscribe({
      next: list => {
        this.pphs.set(list);
        this.chargement.set(false);
        if (list.length) this.choisirPph(list[0].referencePPH);
      },
      error: (e: unknown) => { this.chargement.set(false); this.noterErreur(e, 'Les plans en cours n\'ont pas pu être chargés.'); },
    });
  }

  choisirPph(reference: string): void {
    this.referenceChoisie.set(reference);
    this.comparer();
  }

  choisirDate(date: string): void {
    this.dateChoisie.set(date);
    this.comparer();
  }

  comparer(): void {
    const ref = this.referenceChoisie();
    if (!ref || !this.dateChoisie()) { this.comparaison.set(null); return; }
    this.chargementComparaison.set(true);
    this.erreur.set('');
    this.svc.getComparaisonBC(ref, this.dateChoisie()).subscribe({
      next: c => { this.comparaison.set(c); this.chargementComparaison.set(false); },
      error: (e: unknown) => {
        this.comparaison.set(null);
        this.chargementComparaison.set(false);
        if ((e as { status?: number })?.status === 404) {
          this.erreur.set('Aucun plan trouvé pour ce PPH.');
          return;
        }
        this.noterErreur(e, 'La comparaison n\'a pas pu être calculée.');
      },
    });
  }

  libelle(code: string): string {
    return libelleCategorie(code);
  }

  /** Écart en classe CSS : vert si proche de la théorie, rouge au-delà du seuil. */
  classeEcart(pct: number, theorique: number): string {
    if (theorique <= 0) return 'neutre';
    return Math.abs(pct) > SEUIL_ECART_PCT ? 'alerte' : 'ok';
  }

  /** Borne un pourcentage entre 0 et 100 pour une barre de progression. */
  borne(pct: number): number {
    return Math.max(0, Math.min(100, pct));
  }

  tauxPoste(quantite: number, objectif: number): number {
    return objectif > 0 ? quantite / objectif * 100 : 0;
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
