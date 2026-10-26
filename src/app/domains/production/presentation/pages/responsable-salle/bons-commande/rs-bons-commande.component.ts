import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StockService, BonCommandeBE } from '../../../../../stock/infrastructure/stock.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Groupe = 'TOUS' | 'EN_COURS' | 'RECUS' | 'ANNULES';

/** Groupes de statuts affichés : un BC validé peut avoir avancé jusqu'à la clôture, ou avoir été annulé. */
const GROUPES: Record<Exclude<Groupe, 'TOUS'>, string[]> = {
  EN_COURS: ['VALIDE', 'ENVOYE', 'RECU_PARTIEL'],
  RECUS: ['RECU_TOTAL', 'CLOTURE'],
  ANNULES: ['ANNULE'],
};

/**
 * BONS DE COMMANDE VALIDÉS — Responsable de Salle.
 * Tous les bons de commande validés par le chef de production, quel que soit leur avancement (en cours,
 * reçus, clôturés, ou annulés après validation), avec qui les a validés et quand. Lecture seule.
 */
@Component({
  selector: 'app-rs-bons-commande',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-bons-commande.component.html',
  styleUrls: ['./rs-bons-commande.component.css'],
})
export class RsBonsCommandeComponent implements OnInit {
  private readonly stockSvc = inject(StockService);

  readonly aujourdhui = dateLocaleIso();
  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);
  readonly bcs = signal<BonCommandeBE[]>([]);

  readonly recherche = signal('');
  readonly groupe = signal<Groupe>('TOUS');
  readonly bcSelectionne = signal<BonCommandeBE | null>(null);

  readonly groupes: { code: Groupe; libelle: string }[] = [
    { code: 'TOUS', libelle: 'Tous' },
    { code: 'EN_COURS', libelle: 'En cours' },
    { code: 'RECUS', libelle: 'Reçus / clôturés' },
    { code: 'ANNULES', libelle: 'Annulés' },
  ];

  readonly compteurs = computed(() => {
    const liste = this.bcs();
    const compte = (g: Exclude<Groupe, 'TOUS'>) => liste.filter(bc => GROUPES[g].includes(bc.statut)).length;
    return { TOUS: liste.length, EN_COURS: compte('EN_COURS'), RECUS: compte('RECUS'), ANNULES: compte('ANNULES') };
  });

  /** Liste affichée : groupe et recherche appliqués, les plus récemment validés en premier. */
  readonly bcsFiltres = computed(() => {
    const g = this.groupe();
    const q = this.recherche().trim().toLowerCase();
    return this.bcs()
      .filter(bc => g === 'TOUS' || GROUPES[g].includes(bc.statut))
      .filter(bc => !q
        || bc.numero.toLowerCase().includes(q)
        || (bc.codeFournisseur ?? '').toLowerCase().includes(q)
        || (bc.nomFournisseur ?? '').toLowerCase().includes(q)
        || bc.lignes.some(l => (l.codeProduit ?? '').toLowerCase().includes(q)))
      .sort((a, b) => (b.dateValidation ?? '').localeCompare(a.dateValidation ?? ''));
  });

  // ── Indicateurs ──
  readonly montantTotal = computed(() => this.bcs().reduce((t, bc) => t + this.montant(bc), 0));
  readonly tauxMoyen = computed(() => {
    const liste = this.bcs().filter(bc => this.estEnCours(bc));
    if (!liste.length) return null;
    // Sans taux fourni par l'API, aucune moyenne n'est calculable : null plutôt qu'un faux 0 %.
    const connus = liste.filter(bc => bc.tauxRealisation !== null);
    if (!connus.length) return null;
    return Math.round((connus.reduce((t, bc) => t + (bc.tauxRealisation ?? 0), 0) / connus.length) * 10) / 10;
  });
  readonly nbEnRetard = computed(() => this.bcs().filter(bc => this.joursRetard(bc) > 0).length);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.sessionExpiree.set(false);
    // L'API ne filtre que par statut unique : on garde ici tout BC sorti du brouillon et non annulé.
    this.stockSvc.getBonsCommande().subscribe({
      next: list => {
        this.bcs.set(list.filter(bc => bc.statut !== 'BROUILLON' && bc.statut !== 'ANNULE'));
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
          this.erreur.set(err?.error?.erreur || err?.error?.message || 'Les bons de commande n\'ont pas pu être chargés.');
        }
      },
    });
  }

  estEnCours(bc: BonCommandeBE): boolean {
    return GROUPES.EN_COURS.includes(bc.statut);
  }

  estAnnule(bc: BonCommandeBE): boolean {
    return bc.statut === 'ANNULE';
  }

  libelleStatut(bc: BonCommandeBE): string {
    return bc.statutLibelle ?? bc.statut;
  }

  /** Classe de teinte selon l'avancement du BC dans son cycle. */
  teinte(bc: BonCommandeBE): string {
    if (this.estAnnule(bc)) return 'annule';
    if (GROUPES.RECUS.includes(bc.statut)) return 'recu';
    if (bc.statut === 'VALIDE') return 'valide';
    return 'envoye';
  }

  /** Jours de retard sur la livraison prévue, pour un BC non encore reçu ni annulé. */
  joursRetard(bc: BonCommandeBE): number {
    if (!bc.dateLivraisonPrevue || GROUPES.RECUS.includes(bc.statut) || this.estAnnule(bc)) return 0;
    const [y, m, j] = bc.dateLivraisonPrevue.split('-').map(Number);
    const [ya, ma, ja] = this.aujourdhui.split('-').map(Number);
    const jours = Math.round((Date.UTC(ya, ma - 1, ja) - Date.UTC(y, m - 1, j)) / 86400000);
    return Math.max(0, jours);
  }

  montant(bc: BonCommandeBE): number {
    if (bc.montantTotalHT != null) return bc.montantTotalHT;
    return bc.lignes.reduce((t, l) => t + (l.prixUnitaireHT ?? 0) * l.quantiteCommandee, 0);
  }

  ouvrir(bc: BonCommandeBE): void {
    this.bcSelectionne.set(bc);
  }

  fermer(): void {
    this.bcSelectionne.set(null);
  }
}
