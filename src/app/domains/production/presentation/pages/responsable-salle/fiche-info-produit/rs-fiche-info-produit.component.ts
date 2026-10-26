import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, PPHBE, FicheProductionBE } from '../../../../infrastructure/production.service';
import { AuthService } from '../../../../../../core/auth/auth.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Seuils d'atteinte, en % de la prédiction qui s'applique au produit (mêmes seuils que les autres pages). */
export const SEUIL_VIGILANCE = 50;
export const SEUIL_OBJECTIF_ATTEINT = 100;
export const SEUIL_DEPASSEMENT = 120;

export type SourcePrediction = 'dosage' | 'postes' | null;
export type Niveau = 'attente' | 'bas' | 'moyen' | 'ok' | 'depasse';

/** Vue d'une ligne de fiche : la prédiction affichée dépend de la catégorie du produit. */
interface LigneVue {
  codeProduit: string;
  nomProduit: string;
  quantiteSaisie: number | null;
  prediction: number | null;
  source: SourcePrediction;
  ecart: number | null;
  tauxAvancement: number | null;
  niveau: Niveau;
}

/**
 * FICHE INFO PRODUIT JOURNALIÈRE — Responsable de Salle.
 *
 * Deux prédictions, selon la catégorie du produit :
 * - Dosage (bouillie de soja) : répartition des fûts dosés du jour entre les produits du BC.
 * - Postes (à grignoter) : réalisation du poste qui fabrique le produit (caramel, croquette, arachide enrobée,
 *   chips), hors datage et étiquetage qui ne fabriquent rien.
 * Les deux sont calculées côté serveur et ne sont à jour qu'au moment du calcul : la fiche se génère avant les
 * réalisations du jour, donc un recalcul explicite est nécessaire une fois celles-ci saisies.
 *
 * ⚠️ `GET /fiches/pph/{ref}` (liste) n'autorise pas RESPONSABLE_SALLE — seule la consultation d'une fiche précise
 * (`GET /fiches/pph/{ref}/date/{date}`) l'est. Cette page n'utilise donc jamais la liste.
 */
@Component({
  selector: 'app-rs-fiche-info-produit',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-fiche-info-produit.component.html',
  styleUrls: ['./rs-fiche-info-produit.component.css'],
})
export class RsFicheInfoProduitComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly auth = inject(AuthService);

  readonly seuilVigilance = SEUIL_VIGILANCE;
  readonly seuilAtteint = SEUIL_OBJECTIF_ATTEINT;
  readonly seuilDepassement = SEUIL_DEPASSEMENT;

  readonly chargement = signal(true);
  readonly chargementFiche = signal(false);
  readonly action = signal<'' | 'generation' | 'corrections' | 'recalcul'>('');
  readonly message = signal('');
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  /** Vrai quand aucune fiche n'existe pour ce PPH et cette date (404, cas normal avant génération). */
  readonly sansFiche = signal(false);

  readonly pphs = signal<PPHBE[]>([]);
  readonly referenceChoisie = signal('');
  readonly dateChoisie = signal(dateLocaleIso());
  readonly fiche = signal<FicheProductionBE | null>(null);

  /** Quantités en cours de saisie, indexées par code produit ; vide si rien n'a encore été corrigé. */
  readonly quantites = signal<Record<string, number | null>>({});

  get matricule(): string {
    return this.auth.user()?.matricule ?? '';
  }

  readonly lignes = computed<LigneVue[]>(() => {
    const f = this.fiche();
    if (!f) return [];
    const saisies = this.quantites();
    return f.lignes.map(l => {
      const prediction = l.quantitePrediteDosage ?? l.quantitePreditePostes ?? null;
      const source: SourcePrediction = l.quantitePrediteDosage != null ? 'dosage' : l.quantitePreditePostes != null ? 'postes' : null;
      const quantiteSaisie = l.codeProduit in saisies ? saisies[l.codeProduit] : l.quantiteProduite;
      return {
        codeProduit: l.codeProduit,
        nomProduit: l.nomProduit,
        quantiteSaisie,
        prediction,
        source,
        ecart: l.ecart,
        tauxAvancement: l.tauxAvancement,
        niveau: prediction === null ? 'attente' : this.niveau(prediction > 0 ? (quantiteSaisie ?? 0) / prediction * 100 : 0),
      };
    });
  });

  readonly nbProduits = computed(() => this.lignes().length);
  readonly nbAvecPrediction = computed(() => this.lignes().filter(l => l.prediction !== null).length);
  readonly nbBouillie = computed(() => this.lignes().filter(l => l.source === 'dosage').length);
  readonly nbGrignoter = computed(() => this.lignes().filter(l => l.source === 'postes').length);

  readonly modifie = computed(() => {
    const f = this.fiche();
    if (!f) return false;
    const saisies = this.quantites();
    return f.lignes.some(l => l.codeProduit in saisies && saisies[l.codeProduit] !== l.quantiteProduite);
  });

  readonly erreursEdition = computed(() => {
    const msgs: string[] = [];
    for (const l of this.lignes()) {
      if (l.quantiteSaisie === null || !Number.isFinite(l.quantiteSaisie)) {
        msgs.push(`${l.nomProduit} : quantité invalide.`);
      } else if (l.quantiteSaisie < 0) {
        msgs.push(`${l.nomProduit} : la quantité ne peut pas être négative.`);
      }
    }
    return msgs;
  });

  readonly peutEnregistrerCorrections = computed(() =>
    !!this.fiche() && !this.fiche()!.verrouillee && this.modifie()
    && this.erreursEdition().length === 0 && this.action() === '');
  readonly peutRecalculer = computed(() => !!this.fiche() && !this.fiche()!.verrouillee && this.action() === '');

  ngOnInit(): void {
    this.svc.getPPHs().subscribe({
      next: list => {
        this.pphs.set(list);
        this.chargement.set(false);
        if (list.length) this.choisirPph(list[0].referencePPH);
      },
      error: (e: unknown) => { this.chargement.set(false); this.noterErreur(e, 'Les plans n\'ont pas pu être chargés.'); },
    });
  }

  choisirPph(reference: string): void {
    this.referenceChoisie.set(reference);
    this.charger();
  }

  choisirDate(date: string): void {
    this.dateChoisie.set(date);
    this.charger();
  }

  charger(): void {
    const ref = this.referenceChoisie();
    const date = this.dateChoisie();
    if (!ref || !date) return;
    this.chargementFiche.set(true);
    this.erreur.set('');
    this.sansFiche.set(false);
    this.quantites.set({});
    this.svc.getFiche(ref, date).subscribe({
      next: f => { this.fiche.set(f); this.chargementFiche.set(false); },
      error: (e: unknown) => {
        this.chargementFiche.set(false);
        this.fiche.set(null);
        if ((e as { status?: number })?.status === 404) {
          this.sansFiche.set(true);
          return;
        }
        this.noterErreur(e, 'La fiche n\'a pas pu être chargée.');
      },
    });
  }

  genererFiche(): void {
    const p = this.pphs().find(x => x.referencePPH === this.referenceChoisie());
    if (!p) return;
    if (!this.matricule) { this.erreur.set('Votre matricule est introuvable : reconnectez-vous.'); return; }
    this.action.set('generation');
    this.erreur.set('');
    this.message.set('');
    const lignes = p.lignes.map(l => ({ codeProduit: l.codeProduit, nomProduit: l.nomProduit, quantiteProduite: 0 }));
    this.svc.enregistrerFiche({
      referencePPH: this.referenceChoisie(), semaine: p.semaine, date: this.dateChoisie(),
      matriculeAgentProduction: this.matricule, lignes,
    }).subscribe({
      next: f => {
        this.fiche.set(f);
        this.sansFiche.set(false);
        this.quantites.set({});
        this.message.set('Fiche générée. Les prédictions disponibles au moment de la génération ont été calculées.');
        this.action.set('');
      },
      error: (e: unknown) => { this.action.set(''); this.noterErreur(e, 'La fiche n\'a pas pu être générée.'); },
    });
  }

  majQuantite(codeProduit: string, valeur: number | null): void {
    this.quantites.update(q => ({ ...q, [codeProduit]: valeur === null || valeur === undefined ? null : Number(valeur) }));
  }

  annulerModifications(): void {
    this.quantites.set({});
    this.message.set('');
  }

  enregistrerCorrections(): void {
    const f = this.fiche();
    if (!f || !this.peutEnregistrerCorrections()) return;
    this.action.set('corrections');
    this.erreur.set('');
    this.message.set('');
    const saisies = this.quantites();
    const lignes = f.lignes.map(l => ({
      codeProduit: l.codeProduit, nomProduit: l.nomProduit,
      quantiteProduite: l.codeProduit in saisies ? (saisies[l.codeProduit] ?? 0) : l.quantiteProduite,
    }));
    this.svc.modifierFiche(this.referenceChoisie(), this.dateChoisie(), { lignes }).subscribe({
      next: updated => {
        this.fiche.set(updated);
        this.quantites.set({});
        this.message.set('Corrections enregistrées. Les prédictions ont été recalculées.');
        this.action.set('');
      },
      error: (e: unknown) => { this.action.set(''); this.noterErreur(e, 'Les corrections n\'ont pas pu être enregistrées — fiche probablement verrouillée.'); },
    });
  }

  /** Les prédictions ne sont calculées qu'à la création et à chaque correction : un recalcul explicite les remet à jour. */
  recalculerPredictions(): void {
    if (!this.peutRecalculer()) return;
    this.action.set('recalcul');
    this.erreur.set('');
    this.message.set('');
    this.svc.recalculerPredictionsFiche(this.referenceChoisie(), this.dateChoisie()).subscribe({
      next: f => {
        this.fiche.set(f);
        this.message.set('Prédictions recalculées à partir des fûts dosés et des réalisations des postes.');
        this.action.set('');
      },
      error: (e: unknown) => { this.action.set(''); this.noterErreur(e, 'Les prédictions n\'ont pas pu être recalculées.'); },
    });
  }

  niveau(pct: number): Niveau {
    if (pct >= SEUIL_DEPASSEMENT) return 'depasse';
    if (pct >= SEUIL_OBJECTIF_ATTEINT) return 'ok';
    if (pct >= SEUIL_VIGILANCE) return 'moyen';
    return 'bas';
  }

  libelleNiveau(n: Niveau): string {
    return ({ attente: 'Pas de prédiction', bas: 'Sous le seuil', moyen: 'À surveiller', ok: 'Objectif atteint', depasse: 'Dépassement' } as const)[n];
  }

  libelleSource(s: SourcePrediction): string {
    return s === 'dosage' ? 'Bouillie · dosage' : s === 'postes' ? 'Grignoter · postes' : 'Aucune';
  }

  /** Borne un pourcentage entre 0 et 100 pour une barre de progression. */
  borne(pct: number): number {
    return Math.max(0, Math.min(100, pct));
  }

  /** % de la prédiction atteint par la quantité saisie ; 0 si la prédiction est nulle (évite une division par zéro). */
  pourcentageAtteint(l: LigneVue): number {
    return l.prediction && l.prediction > 0 ? (l.quantiteSaisie ?? 0) / l.prediction * 100 : 0;
  }

  imprimer(): void {
    const f = this.fiche();
    if (!f) return;
    const w = window.open('', '_blank');
    if (!w) { this.message.set('Autorisez les pop-ups pour imprimer.'); return; }
    const lignesHtml = this.lignes().map(l => `<tr>
      <td>${l.nomProduit}</td><td>${l.quantiteSaisie ?? '—'}</td>
      <td>${this.libelleSource(l.source)}</td><td>${l.prediction ?? '—'}</td>
      <td>${l.ecart ?? '—'}</td><td>${l.tauxAvancement ?? '—'}%</td></tr>`).join('');
    w.document.write(`<html><head><title>Fiche Info Produit ${f.referencePPH} ${f.date}</title>
      <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:6px;font-size:12px}</style></head>
      <body><h1>Fiche Info Produit</h1><p>PPH : ${f.referencePPH} — Date : ${f.date} — Fûts dosés : ${f.nbFutsProduits}</p>
      <table><thead><tr><th>Produit</th><th>Quantité réelle</th><th>Source prédiction</th><th>Prédiction</th><th>Écart</th><th>Progression</th></tr></thead>
      <tbody>${lignesHtml}</tbody></table></body></html>`);
    w.document.close();
    w.print();
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
