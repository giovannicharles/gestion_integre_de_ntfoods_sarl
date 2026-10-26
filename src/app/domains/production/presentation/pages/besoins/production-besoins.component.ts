import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ProductionService, ExpressionBesoinBE, PPHBE, TYPES_BESOIN
} from '../../../infrastructure/production.service';

type StatutFiltre = 'TOUS' | 'EN_ATTENTE' | 'VALIDE' | 'REJETE';

interface FormBesoin {
  numero: string;
  referencePPH: string;
  type: string;
  codeProduit: string;
  designationProduit: string;
  quantiteDemandee: number | null;
  unite: string;
  dateBesoin: string;
  motif: string;
}

/** Date au format yyyy-mm-dd en heure locale. */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Numéro unique lisible : BES-AAAAMMJJ-XXXXXX (6 caractères aléatoires). */
function genererNumero(): string {
  const aleatoire = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
    : Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BES-${formaterDate(new Date()).replace(/-/g, '')}-${aleatoire}`;
}

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  EN_ATTENTE: { libelle: 'En attente', classe: 'bs-statut-attente' },
  VALIDE: { libelle: 'Validé', classe: 'bs-statut-ok' },
  REJETE: { libelle: 'Rejeté', classe: 'bs-statut-erreur' },
};

/**
 * EXPRESSIONS DE BESOIN — signalement des ruptures de matières premières, emballages et consommables.
 * Tous les besoins sont chargés une fois : filtres, recherche et compteurs se calculent sur la page.
 */
@Component({
  selector: 'app-production-besoins',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './production-besoins.component.html',
  styleUrls: ['./production-besoins.component.css']
})
export class ProductionBesoinsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = formaterDate(new Date());
  readonly typesBesoin = TYPES_BESOIN;

  // ── Chargement ──
  besoins = signal<ExpressionBesoinBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  chargement = signal(false);
  erreur = signal('');
  derniereMaj = signal<Date | null>(null);
  private requete = 0;

  // ── Filtres ──
  statut = signal<StatutFiltre>('TOUS');
  type = signal('');
  recherche = signal('');

  readonly filtres: { code: StatutFiltre; libelle: string }[] = [
    { code: 'TOUS', libelle: 'Tous' },
    { code: 'EN_ATTENTE', libelle: 'En attente' },
    { code: 'VALIDE', libelle: 'Validés' },
    { code: 'REJETE', libelle: 'Rejetés' },
  ];

  /** Compteurs calculés sur la liste complète, indépendamment des filtres. */
  compteStatut = (code: StatutFiltre): number =>
    code === 'TOUS' ? this.besoins().length : this.besoins().filter(b => b.statut === code).length;

  besoinsFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const s = this.statut();
    const t = this.type();
    return this.besoins()
      .filter(b => s === 'TOUS' || b.statut === s)
      .filter(b => !t || b.type === t)
      .filter(b => !q
        || b.numero.toLowerCase().includes(q)
        || b.codeProduit.toLowerCase().includes(q)
        || b.designationProduit.toLowerCase().includes(q)
        || (b.referencePPH ?? '').toLowerCase().includes(q)
        || b.matriculeDemandeur.toLowerCase().includes(q))
      .sort((a, b) => (b.dateCreation ?? '').localeCompare(a.dateCreation ?? ''));
  });

  // ── Indicateurs ──
  kpis = computed<{ libelle: string; valeur: string; detail: string; alerte?: boolean }[]>(() => {
    const l = this.besoins();
    const attente = l.filter(b => b.statut === 'EN_ATTENTE');
    const quantiteAttente = attente.reduce((t, b) => t + b.quantiteDemandee, 0);
    return [
      { libelle: 'En attente', valeur: String(attente.length), detail: attente.length ? `${this.formaterQuantite(quantiteAttente)} unité(s) demandées` : 'rien à traiter', alerte: attente.length > 0 },
      { libelle: 'Validés', valeur: String(l.filter(b => b.statut === 'VALIDE').length), detail: 'approvisionnement lancé' },
      { libelle: 'Rejetés', valeur: String(l.filter(b => b.statut === 'REJETE').length), detail: 'non retenus' },
      { libelle: 'Total', valeur: String(l.length), detail: 'besoins signalés' },
    ];
  });

  // ── Signalement ──
  tiroirSignalerOuvert = signal(false);
  form = signal<FormBesoin>(this.formVide());
  erreurFormulaire = signal('');
  envoi = signal(false);

  /** Erreur bloquante du formulaire, ou '' si valide. */
  erreurForm = computed(() => {
    const f = this.form();
    if (!f.codeProduit.trim()) return 'Indiquez le code du produit';
    if (!f.designationProduit.trim()) return 'Indiquez la désignation';
    if (!(Number(f.quantiteDemandee) > 0)) return 'La quantité doit être supérieure à 0';
    if (!f.unite.trim()) return 'Indiquez l\'unité';
    if (f.dateBesoin && f.dateBesoin < this.aujourdhui) return 'La date du besoin ne peut pas être dans le passé';
    return '';
  });

  // ── Décisions ──
  aValider = signal<ExpressionBesoinBE | null>(null);
  aRejeter = signal<ExpressionBesoinBE | null>(null);
  motifRejet = signal('');
  actionEnCours = signal<string | null>(null);

  detail = signal<ExpressionBesoinBE | null>(null);

  notification = signal<{ type: 'ok' | 'erreur'; texte: string } | null>(null);
  private minuterie: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.charger();
    this.svc.getPPHs().subscribe({ next: p => this.pphs.set(p), error: () => this.pphs.set([]) });
  }

  @HostListener('document:keydown.escape')
  onEchap(): void {
    if (this.aValider()) this.aValider.set(null);
    else if (this.aRejeter()) this.aRejeter.set(null);
    else if (this.detail()) this.detail.set(null);
    else if (this.tiroirSignalerOuvert() && !this.envoi()) this.tiroirSignalerOuvert.set(false);
  }

  charger(): void {
    const id = ++this.requete;
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getBesoins().subscribe({
      next: liste => {
        if (id !== this.requete) return;
        this.besoins.set(liste);
        this.chargement.set(false);
        this.derniereMaj.set(new Date());
      },
      error: e => {
        if (id !== this.requete) return;
        this.chargement.set(false);
        this.erreur.set(e?.error?.erreur || e?.error?.message || 'Chargement impossible.');
      },
    });
  }

  // ── Signalement ──
  private formVide(): FormBesoin {
    return {
      numero: '', referencePPH: '', type: 'MATIERE_PREMIERE', codeProduit: '', designationProduit: '',
      quantiteDemandee: null, unite: 'kg', dateBesoin: '', motif: '',
    };
  }

  ouvrirSignaler(): void {
    this.form.set({ ...this.formVide(), numero: genererNumero() });
    this.erreurFormulaire.set('');
    this.tiroirSignalerOuvert.set(true);
  }

  fermerSignaler(): void {
    if (this.envoi()) return;
    this.tiroirSignalerOuvert.set(false);
  }

  majForm(champ: keyof FormBesoin, valeur: unknown): void {
    const propre = typeof valeur === 'number' && Number.isNaN(valeur) ? null : valeur;
    this.form.update(f => ({ ...f, [champ]: propre }));
  }

  signaler(): void {
    if (this.erreurForm() || this.envoi()) return;
    const f = this.form();
    this.envoi.set(true);
    this.erreurFormulaire.set('');
    this.svc.signalerBesoin({
      numero: f.numero,
      referencePPH: f.referencePPH || undefined,
      type: f.type,
      codeProduit: f.codeProduit.trim(),
      designationProduit: f.designationProduit.trim(),
      quantiteDemandee: Number(f.quantiteDemandee),
      unite: f.unite.trim(),
      dateBesoin: f.dateBesoin || undefined,
      motif: f.motif.trim() || undefined,
    }).subscribe({
      next: b => {
        this.envoi.set(false);
        this.tiroirSignalerOuvert.set(false);
        this.besoins.update(liste => [b, ...liste]);
        this.notifier(`Besoin ${b.numero} signalé.`, 'ok');
      },
      error: e => {
        this.envoi.set(false);
        this.erreurFormulaire.set(e?.error?.erreur || e?.error?.message || 'Signalement impossible.');
      },
    });
  }

  // ── Validation et rejet ──
  demanderValidation(b: ExpressionBesoinBE): void { this.aValider.set(b); }

  confirmerValidation(): void {
    const b = this.aValider();
    if (!b) return;
    this.actionEnCours.set(b.numero);
    this.svc.validerBesoin(b.numero).subscribe({
      next: maj => {
        this.remplacer(maj);
        this.actionEnCours.set(null);
        this.aValider.set(null);
        this.notifier(`Besoin ${maj.numero} validé.`, 'ok');
      },
      error: e => {
        this.actionEnCours.set(null);
        this.aValider.set(null);
        this.notifier(e?.error?.erreur || e?.error?.message || 'Validation impossible.', 'erreur');
      },
    });
  }

  ouvrirRejet(b: ExpressionBesoinBE): void {
    this.motifRejet.set('');
    this.aRejeter.set(b);
  }

  confirmerRejet(): void {
    const b = this.aRejeter();
    const motif = this.motifRejet().trim();
    if (!b || motif.length < 3) return;
    this.actionEnCours.set(b.numero);
    this.svc.rejeterBesoin(b.numero, motif).subscribe({
      next: maj => {
        this.remplacer(maj);
        this.actionEnCours.set(null);
        this.aRejeter.set(null);
        this.notifier(`Besoin ${maj.numero} rejeté.`, 'ok');
      },
      error: e => {
        this.actionEnCours.set(null);
        this.notifier(e?.error?.erreur || e?.error?.message || 'Rejet impossible.', 'erreur');
      },
    });
  }

  private remplacer(b: ExpressionBesoinBE): void {
    this.besoins.update(liste => liste.map(x => x.numero === b.numero ? b : x));
    if (this.detail()?.numero === b.numero) this.detail.set(b);
  }

  // ── Affichage ──
  notifier(texte: string, type: 'ok' | 'erreur'): void {
    this.notification.set({ type, texte });
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.notification.set(null), 5000);
  }

  typeLabel(t: string): string {
    return this.typesBesoin.find(x => x.code === t)?.libelle ?? t;
  }

  libelleStatut(s: string): string { return STATUTS[s]?.libelle ?? s; }
  classeStatut(s: string): string { return STATUTS[s]?.classe ?? ''; }

  formaterQuantite(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);
  }

  /** Une décision n'est possible que sur un besoin en attente. */
  peutDecider(b: ExpressionBesoinBE): boolean {
    return b.statut === 'EN_ATTENTE';
  }

}
