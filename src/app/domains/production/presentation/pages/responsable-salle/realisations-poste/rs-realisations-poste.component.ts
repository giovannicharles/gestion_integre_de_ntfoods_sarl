import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ProductionService, PPHBE, AffectationBE, CodePosteRef,
} from '../../../../infrastructure/production.service';

/** Formulaire de saisie d'un poste. Un poste sans formulaire dédié reçoit le formulaire simple (quantité dans son unité). */
type Famille = 'simple' | 'chips' | 'conditionnement' | 'etiquetage' | 'datage';

/** Valeurs saisies. Les champs entiers sont des comptes d'unités ; les autres peuvent être décimaux. */
interface Saisie {
  quantite: number;
  kgChips: number;
  epluches: number;
  decoupes: number;
  cartons: number;
  sceaux: number;
  etiquettes: number;
  sachets: number;
}

type Champ = keyof Saisie;

const SAISIE_VIDE: Saisie = {
  quantite: 0, kgChips: 0, epluches: 0, decoupes: 0, cartons: 0, sceaux: 0, etiquettes: 0, sachets: 0,
};

const LIBELLES_CHAMPS: Record<Champ, string> = {
  quantite: 'Quantité', kgChips: 'Kg produits', epluches: 'Régimes épluchés', decoupes: 'Régimes découpés',
  cartons: 'Cartons produits', sceaux: 'Sceaux étiquetés', etiquettes: 'Étiquettes datées', sachets: 'Sachets datés',
};

const CHAMPS_ENTIERS = new Set<Champ>(['epluches', 'decoupes', 'cartons', 'sceaux', 'etiquettes', 'sachets']);

const CHAMPS_PAR_FAMILLE: Record<Famille, Champ[]> = {
  simple: ['quantite'],
  chips: ['kgChips', 'epluches', 'decoupes'],
  conditionnement: ['quantite', 'cartons'],
  etiquetage: ['sceaux'],
  datage: ['etiquettes', 'sachets'],
};

/** Famille d'un poste, déduite de son code. Les autres postes (dont ceux créés plus tard) utilisent le formulaire simple. */
function familleDe(code: string): Famille {
  if (code === 'CHIPS_PLANTAIN') return 'chips';
  if (code.startsWith('CONDITIONNEMENT_')) return 'conditionnement';
  if (code === 'ETIQUETAGE') return 'etiquetage';
  if (code === 'DATAGE') return 'datage';
  return 'simple';
}

/**
 * SAISIE DES RÉALISATIONS — Responsable de Salle.
 * Enregistre la production de chaque poste affecté aujourd'hui. Une saisie remplace la précédente pour le même poste :
 * le formulaire est pré-rempli avec les valeurs déjà enregistrées, et un remplacement demande confirmation.
 * Postes et unités viennent du serveur ; seule la forme du formulaire dépend du code du poste.
 */
@Component({
  selector: 'app-rs-realisations-poste',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-realisations-poste.component.html',
  styleUrls: ['./rs-realisations-poste.component.css'],
})
export class RsRealisationsPosteComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly libelles = LIBELLES_CHAMPS;
  readonly aujourdhui = new Date();

  readonly chargement = signal(true);
  readonly chargementAffectation = signal(false);
  readonly enregistrement = signal(false);
  readonly message = signal('');
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  /** Vrai quand le plan n'a pas d'affectation pour aujourd'hui (réponse 404, cas normal). */
  readonly sansAffectation = signal(false);

  readonly pphs = signal<PPHBE[]>([]);
  readonly referenceChoisie = signal('');
  readonly affectation = signal<AffectationBE | null>(null);
  readonly postes = signal<CodePosteRef[]>([]);
  readonly posteChoisi = signal('');
  readonly form = signal<Saisie>({ ...SAISIE_VIDE });

  readonly posteCourant = computed(() => this.postes().find(p => p.code === this.posteChoisi()) ?? null);
  readonly affectes = computed(() => new Set((this.affectation()?.lignes ?? []).map(l => l.codePoste)));
  readonly saisiesParPoste = computed(() =>
    new Map((this.affectation()?.saisies ?? []).map(s => [s.codePoste, s])));
  readonly saisieCourante = computed(() => this.saisiesParPoste().get(this.posteChoisi()) ?? null);
  readonly posteAffecte = computed(() => this.affectes().has(this.posteChoisi()));
  readonly famille = computed(() => familleDe(this.posteChoisi()));
  readonly objectifCourant = computed(() =>
    this.affectation()?.lignes.find(l => l.codePoste === this.posteChoisi())?.objectifAjuste ?? 0);

  readonly nbAffectes = computed(() => this.affectes().size);
  readonly nbSaisis = computed(() => [...this.affectes()].filter(c => this.saisiesParPoste().has(c)).length);

  /** Erreurs bloquantes du formulaire courant. */
  readonly erreursFormulaire = computed(() => {
    const f = this.form();
    const msgs: string[] = [];
    for (const champ of CHAMPS_PAR_FAMILLE[this.famille()]) {
      const v = f[champ];
      const nom = LIBELLES_CHAMPS[champ];
      if (!Number.isFinite(v)) msgs.push(`${nom} : saisissez un nombre.`);
      else if (v < 0) msgs.push(`${nom} : la valeur ne peut pas être négative.`);
      else if (CHAMPS_ENTIERS.has(champ) && !Number.isInteger(v)) msgs.push(`${nom} : nombre entier attendu.`);
    }
    return msgs;
  });

  /** Avertissement non bloquant : plus de régimes découpés que d'épluchés (même règle que le serveur). */
  readonly avertissementChips = computed(() => {
    const f = this.form();
    return this.famille() === 'chips' && f.decoupes > f.epluches
      ? `${f.decoupes} régimes découpés dépassent les ${f.epluches} régimes épluchés saisis.`
      : null;
  });

  readonly peutEnregistrer = computed(() =>
    !!this.affectation() && !!this.posteCourant() && this.posteAffecte()
    && this.erreursFormulaire().length === 0 && !this.enregistrement());

  ngOnInit(): void {
    this.chargerPostes();
    this.chargerPphs();
  }

  /** Postes du serveur : un poste ajouté en base apparaît dans les onglets sans toucher au code. */
  private chargerPostes(): void {
    this.svc.getPostesProduction().subscribe({
      next: list => {
        this.postes.set(list);
        if (!this.posteChoisi() && list.length) this.posteChoisi.set(list[0].code);
      },
      error: (e: unknown) => this.noterErreur(e, 'Le référentiel des postes n\'a pas pu être chargé.'),
    });
  }

  chargerPphs(): void {
    this.chargement.set(true);
    this.svc.getPPHs('EN_COURS').subscribe({
      next: list => {
        this.pphs.set(list);
        this.chargement.set(false);
        if (list.length === 0) {
          this.referenceChoisie.set('');
          this.affectation.set(null);
        } else if (!list.some(p => p.referencePPH === this.referenceChoisie())) {
          this.choisirPph(list[0].referencePPH);
        }
      },
      error: (e: unknown) => { this.chargement.set(false); this.noterErreur(e, 'Les plans en cours n\'ont pas pu être chargés.'); },
    });
  }

  choisirPph(reference: string): void {
    this.referenceChoisie.set(reference);
    this.affectation.set(null);
    this.sansAffectation.set(false);
    this.message.set('');
    this.erreur.set('');
    if (reference) this.chargerAffectation(reference);
  }

  chargerAffectation(reference: string): void {
    this.chargementAffectation.set(true);
    this.svc.getAffectationDuJour(reference).subscribe({
      next: a => {
        this.affectation.set(a);
        this.chargementAffectation.set(false);
        this.choisirPosteParDefaut(a);
      },
      error: (e: unknown) => {
        this.chargementAffectation.set(false);
        if ((e as { status?: number })?.status === 404) {
          this.sansAffectation.set(true);
          return;
        }
        this.noterErreur(e, 'L\'affectation du jour n\'a pas pu être chargée.');
      },
    });
  }

  /** Ouvre le premier poste affecté sans réalisation, sinon le premier poste affecté. */
  private choisirPosteParDefaut(a: AffectationBE): void {
    const saisis = new Set(a.saisies.map(s => s.codePoste));
    const cible = a.lignes.find(l => !saisis.has(l.codePoste)) ?? a.lignes[0];
    if (cible) this.choisirPoste(cible.codePoste);
  }

  choisirPoste(code: string): void {
    this.posteChoisi.set(code);
    this.message.set('');
    this.erreur.set('');
    this.preremplir();
  }

  /** Reprend les valeurs déjà enregistrées pour le poste, afin qu'un nouvel envoi ne les efface pas. */
  private preremplir(): void {
    const s = this.saisieCourante();
    if (!s) { this.form.set({ ...SAISIE_VIDE }); return; }
    const d = s.details;
    this.form.set({
      quantite: s.quantiteRealisee,
      kgChips: d?.kgChipsProduits ?? s.quantiteRealisee,
      epluches: d?.nbRegimesEpluches ?? 0,
      decoupes: d?.nbRegimesDecoupes ?? 0,
      cartons: d?.nbCartonsProduits ?? 0,
      sceaux: d?.nbSceauxEtiquetes ?? s.quantiteRealisee,
      etiquettes: d?.nbEtiquettesDatees ?? s.quantiteRealisee,
      sachets: d?.nbSachetsDates ?? 0,
    });
  }

  majChamp(champ: Champ, valeur: number | null): void {
    const v = valeur === null || valeur === undefined ? NaN : Number(valeur);
    this.form.update(f => ({ ...f, [champ]: v }));
  }

  enregistrer(): void {
    const a = this.affectation();
    const poste = this.posteCourant();
    if (!a || !poste || !this.peutEnregistrer()) return;
    if (this.saisieCourante() && !confirm(`Une réalisation est déjà enregistrée pour ${poste.libelle}. Elle sera remplacée. Continuer ?`)) return;

    const f = this.form();
    let quantite: number;
    let details: Record<string, number> | undefined;
    switch (this.famille()) {
      case 'chips':
        quantite = f.kgChips;
        details = { nbRegimesEpluches: f.epluches, nbRegimesDecoupes: f.decoupes, kgChipsProduits: f.kgChips };
        break;
      case 'conditionnement':
        quantite = f.quantite;
        details = { nbCartonsProduits: f.cartons };
        break;
      case 'etiquetage':
        quantite = f.sceaux;
        details = { nbSceauxEtiquetes: f.sceaux };
        break;
      case 'datage':
        quantite = f.etiquettes;
        details = { nbEtiquettesDatees: f.etiquettes, nbSachetsDates: f.sachets };
        break;
      default:
        quantite = f.quantite;
    }

    this.enregistrement.set(true);
    this.erreur.set('');
    this.message.set('');
    this.svc.saisirRealisationPoste({
      affectationId: a.id,
      poste: poste.code,
      quantiteRealisee: quantite,
      details,
    }).subscribe({
      next: maj => {
        this.affectation.set(maj);
        const s = maj.saisies.find(x => x.codePoste === poste.code);
        const avert = s?.warnings?.length ? ` — ${s.warnings.join(' ; ')}` : '';
        this.message.set(`Réalisation enregistrée pour ${poste.libelle}.${avert}`);
        this.preremplir();
        this.enregistrement.set(false);
      },
      error: (e: unknown) => {
        this.enregistrement.set(false);
        this.noterErreur(e, 'La réalisation n\'a pas pu être enregistrée.');
      },
    });
  }

  /** Borne un pourcentage entre 0 et 100 pour la barre de progression. */
  borne(pct: number): number {
    return Math.max(0, Math.min(100, pct));
  }

  libellePoste(code: string): string {
    return this.postes().find(p => p.code === code)?.libelle ?? code;
  }

  uniteDuPoste(code: string): string {
    return this.postes().find(p => p.code === code)?.unite ?? '';
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
