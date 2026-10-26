import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of, Observable, catchError, map } from 'rxjs';
import {
  ProductionService, PPHBE, LotBE, ExpressionBesoinBE, RegistreProductionBE, AffectationBE,
  SessionBroyageBE, SessionDosageBE
} from '../../../../infrastructure/production.service';

type Groupe = 'pph' | 'lot' | 'besoin' | 'saisie' | 'production';
type Periode = 7 | 30 | 90;

/**
 * Un événement de la timeline. Chaque date et chaque auteur viennent d'un champ stocké
 * sur l'entité ; aucun événement n'est inventé.
 */
interface Evenement {
  id: string;
  groupe: Groupe;
  titre: string;
  detail: string;
  auteur: string | null;
  date: string;
  lien: string;
}

/** Date au format yyyy-mm-dd en heure locale. */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Date yyyy-mm-dd (ou date-heure) → yyyy-mm-dd, pour filtrer sur la période. */
function jourDe(iso: string | null | undefined): string {
  return (iso ?? '').slice(0, 10);
}

const GROUPES: { code: Groupe; libelle: string; icone: string }[] = [
  { code: 'pph', libelle: 'Plans de production', icone: 'fa-calendar-week' },
  { code: 'production', libelle: 'Broyage et dosage', icone: 'fa-gears' },
  { code: 'saisie', libelle: 'Registres et affectations', icone: 'fa-users-gear' },
  { code: 'lot', libelle: 'Lots', icone: 'fa-boxes-packing' },
  { code: 'besoin', libelle: 'Besoins', icone: 'fa-triangle-exclamation' },
];

/**
 * HISTORIQUE — Chef de Production.
 * Timeline de l'activité de production sur une période : plans, broyage, dosage,
 * registres, affectations, lots et besoins. Pas de journal d'audit généré par le backend :
 * l'historique reprend les dates et auteurs déjà stockés sur chaque entité.
 */
@Component({
  selector: 'app-cp-historique',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './cp-historique.component.html',
  styleUrls: ['./cp-historique.component.css']
})
export class CpHistoriqueComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = formaterDate(new Date());
  readonly groupes = GROUPES;

  // ── Période ──
  periode = signal<Periode>(30);
  readonly periodes: Periode[] = [7, 30, 90];
  debut = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() - (this.periode() - 1));
    return formaterDate(d);
  });

  // ── Chargement ──
  chargement = signal(false);
  derniereMaj = signal<Date | null>(null);
  erreurs = signal<string[]>([]);
  private requete = 0;

  pphs = signal<PPHBE[]>([]);
  lots = signal<LotBE[]>([]);
  besoins = signal<ExpressionBesoinBE[]>([]);
  registres = signal<RegistreProductionBE[]>([]);
  affectations = signal<AffectationBE[]>([]);
  broyages = signal<SessionBroyageBE[]>([]);
  dosages = signal<SessionDosageBE[]>([]);

  // ── Filtres ──
  filtreGroupe = signal<Groupe | ''>('');
  filtreAuteur = signal('');
  recherche = signal('');

  /** Tous les événements, sans filtre, sur la période choisie. */
  tous = computed<Evenement[]>(() => {
    const debut = this.debut();
    const liste: Evenement[] = [];

    for (const p of this.pphs()) {
      if (p.dateSoumission && jourDe(p.dateSoumission) >= debut) {
        liste.push({
          id: `pph-${p.referencePPH}`, groupe: 'pph',
          titre: `Plan ${p.referencePPH} soumis`,
          detail: `Semaine ${p.semaine} — statut actuel : ${this.libelleStatutPph(p.statut)}`,
          auteur: p.matriculeChefProduction, date: p.dateSoumission, lien: '/production/plan',
        });
      }
    }

    for (const r of this.registres()) {
      if (jourDe(r.dateCreation) >= debut) {
        liste.push({
          id: `registre-${r.id}`, groupe: 'saisie',
          titre: `Registre de ${r.referencePPH} enregistré`,
          detail: `${r.nbPresents} présent(s), ${r.nbAbsents} absent(s) le ${this.fr(r.date)}`,
          auteur: r.matriculeChefProduction, date: r.dateCreation, lien: '/production/employes',
        });
      }
      if (r.dateModification && jourDe(r.dateModification) >= debut) {
        liste.push({
          id: `registre-mod-${r.id}`, groupe: 'saisie',
          titre: `Registre de ${r.referencePPH} modifié`,
          detail: `Registre du ${this.fr(r.date)}`,
          auteur: null, date: r.dateModification, lien: '/production/employes',
        });
      }
    }

    for (const a of this.affectations()) {
      if (a.dateCreation && jourDe(a.dateCreation) >= debut) {
        liste.push({
          id: `aff-${a.id}`, groupe: 'saisie',
          titre: `Affectation de ${a.referencePPH} créée`,
          detail: `${a.lignes.length} poste(s) — responsable ${a.matriculeAgent}`,
          auteur: a.matriculeAgent, date: a.dateCreation, lien: '/production/saisie',
        });
      }
      if (a.statut === 'VALIDEE' && a.dateModification && jourDe(a.dateModification) >= debut) {
        liste.push({
          id: `aff-valid-${a.id}`, groupe: 'saisie',
          titre: `Affectation de ${a.referencePPH} validée`,
          detail: `Validée pour le ${this.fr(a.date)}`,
          auteur: null, date: a.dateModification, lien: '/production/saisie',
        });
      }
    }

    for (const b of this.broyages()) {
      if (b.dateCreation && jourDe(b.dateCreation) >= debut) {
        liste.push({
          id: `broyage-${b.id}`, groupe: 'production',
          titre: `Broyage ${b.typePoudreLibelle} ouvert`,
          detail: `PPH ${b.referencePPH} — objectif ${b.objectifJournalierKg} kg`,
          auteur: b.matriculeChefMachiniste, date: b.dateCreation, lien: '/production/chef-production/performances',
        });
      }
      if (b.statut === 'CLOTUREE' && b.dateModification && jourDe(b.dateModification) >= debut) {
        liste.push({
          id: `broyage-cloture-${b.id}`, groupe: 'production',
          titre: `Broyage ${b.typePoudreLibelle} clôturé`,
          detail: `${b.totalRealiseKg} kg réalisés sur ${b.objectifJournalierKg} kg — PPH ${b.referencePPH}`,
          auteur: b.matriculeChefMachiniste, date: b.dateModification, lien: '/production/chef-production/performances',
        });
      }
    }

    for (const d of this.dosages()) {
      if (d.dateCreation && jourDe(d.dateCreation) >= debut) {
        liste.push({
          id: `dosage-${d.id}`, groupe: 'production',
          titre: `Dosage ouvert — PPH ${d.referencePPH}`,
          detail: `${d.nbFutsProduits} fût(s) produit(s), ${d.nbFutsNets} net(s)`,
          auteur: d.matriculeAgentDoseur, date: d.dateCreation, lien: '/production/saisie',
        });
      }
      if (d.cloturee && d.dateModification && jourDe(d.dateModification) >= debut) {
        liste.push({
          id: `dosage-cloture-${d.id}`, groupe: 'production',
          titre: `Dosage clôturé — PPH ${d.referencePPH}`,
          detail: `${d.nbFutsNets} fût(s) net(s) pour ${d.nbFutsProduits} produit(s)`,
          auteur: d.matriculeAgentDoseur, date: d.dateModification, lien: '/production/saisie',
        });
      }
      if (d.justificationEcart && d.dateModification && jourDe(d.dateModification) >= debut) {
        liste.push({
          id: `dosage-ecart-${d.id}`, groupe: 'production',
          titre: `Écart de dosage justifié — PPH ${d.referencePPH}`,
          detail: d.justificationEcart,
          auteur: d.matriculeAgentDoseur, date: d.dateModification, lien: '/production/chef-production/alertes',
        });
      }
    }

    for (const l of this.lots()) {
      if (l.createdAt && jourDe(l.createdAt) >= debut) {
        liste.push({
          id: `lot-${l.numeroLot}`, groupe: 'lot',
          titre: `Lot ${l.numeroLot} déclaré`,
          detail: `${l.productName} — ${this.kg(l.declaredQuantityKg)}`,
          auteur: l.declaredBy ?? l.matriculeChefProduction, date: l.createdAt, lien: '/production/lots',
        });
      }
      if (l.matriculeGestionnaireValidation && l.validatedAt && jourDe(l.validatedAt) >= debut) {
        const rejete = l.statut === 'REJETE';
        liste.push({
          id: `lot-decision-${l.numeroLot}`, groupe: 'lot',
          titre: `Lot ${l.numeroLot} ${rejete ? 'rejeté' : 'validé'} par le stock`,
          detail: rejete ? (l.motifRejet || 'motif non renseigné') : `${l.productName} intégré au stock`,
          auteur: l.matriculeGestionnaireValidation, date: l.validatedAt, lien: '/production/lots',
        });
      }
    }

    for (const b of this.besoins()) {
      if (jourDe(b.dateCreation) >= debut) {
        liste.push({
          id: `besoin-${b.numero}`, groupe: 'besoin',
          titre: `Besoin ${b.numero} signalé`,
          detail: `${b.designationProduit} — ${b.quantiteDemandee} ${b.unite}`,
          auteur: b.matriculeDemandeur, date: b.dateCreation, lien: '/production/besoins',
        });
      }
      if (b.matriculeValidateur && b.dateModification && jourDe(b.dateModification) >= debut) {
        const rejete = b.statut === 'REJETE';
        liste.push({
          id: `besoin-decision-${b.numero}`, groupe: 'besoin',
          titre: `Besoin ${b.numero} ${rejete ? 'rejeté' : 'validé'}`,
          detail: rejete ? (b.motifRejet || 'motif non renseigné') : `${b.designationProduit} — approvisionnement lancé`,
          auteur: b.matriculeValidateur, date: b.dateModification, lien: '/production/besoins',
        });
      }
    }

    return liste.sort((a, b) => b.date.localeCompare(a.date));
  });

  /** Auteurs présents dans la période, pour le filtre par personne. */
  auteurs = computed(() => [...new Set(this.tous().map(e => e.auteur).filter((a): a is string => !!a))].sort());

  filtres = computed(() => {
    const g = this.filtreGroupe();
    const a = this.filtreAuteur();
    const q = this.recherche().trim().toLowerCase();
    return this.tous()
      .filter(e => !g || e.groupe === g)
      .filter(e => !a || e.auteur === a)
      .filter(e => !q || e.titre.toLowerCase().includes(q) || e.detail.toLowerCase().includes(q) || (e.auteur ?? '').toLowerCase().includes(q));
  });

  /** Événements regroupés par jour, du plus récent au plus ancien. */
  parJour = computed(() => {
    const groupes = new Map<string, Evenement[]>();
    for (const e of this.filtres()) {
      const jour = jourDe(e.date);
      groupes.set(jour, [...(groupes.get(jour) ?? []), e]);
    }
    return [...groupes.entries()].map(([jour, evenements]) => ({ jour, evenements }));
  });

  compteGroupe = (g: Groupe): number => this.tous().filter(e => e.groupe === g).length;

  nbLotsRejetes = computed(() => this.tous().filter(e => e.groupe === 'lot' && e.titre.includes('rejeté')).length);
  nbBesoinsTraites = computed(() => this.tous().filter(e => e.groupe === 'besoin' && !e.titre.includes('signalé')).length);

  // ── Chargement ──
  ngOnInit(): void { this.charger(); }

  choisirPeriode(p: Periode): void {
    if (p === this.periode()) return;
    this.periode.set(p);
    this.charger();
  }

  charger(): void {
    const id = ++this.requete;
    this.chargement.set(true);
    const debut = this.debut();
    const fin = this.aujourdhui;

    const garde = <T>(obs: Observable<T>, nom: string, vide: T) =>
      obs.pipe(map(v => ({ ok: true as const, v, nom })), catchError(() => of({ ok: false as const, v: vide, nom })));

    forkJoin({
      pphs: garde(this.svc.getPPHs(), 'plans', [] as PPHBE[]),
      lots: garde(this.svc.getLots(), 'lots', [] as LotBE[]),
      besoins: garde(this.svc.getBesoins(), 'besoins', [] as ExpressionBesoinBE[]),
      registres: garde(this.svc.getRegistres({ debut, fin }), 'registres', [] as RegistreProductionBE[]),
      affectations: garde(this.svc.getAffectations({ debut, fin }), 'affectations', [] as AffectationBE[]),
      broyages: garde(this.svc.getSessionsBroyage({ debut, fin }), 'broyage', [] as SessionBroyageBE[]),
      dosages: garde(this.svc.getSessionsDosageParPeriode(debut, fin), 'dosage', [] as SessionDosageBE[]),
    }).subscribe(r => {
      if (id !== this.requete) return;
      this.erreurs.set(Object.values(r).filter(x => !x.ok).map(x => x.nom));
      this.pphs.set(r.pphs.v);
      this.lots.set(r.lots.v);
      this.besoins.set(r.besoins.v);
      this.registres.set(r.registres.v);
      this.affectations.set(r.affectations.v);
      this.broyages.set(r.broyages.v);
      this.dosages.set(r.dosages.v);
      this.chargement.set(false);
      this.derniereMaj.set(new Date());
    });
  }

  reinitialiser(): void {
    this.filtreGroupe.set('');
    this.filtreAuteur.set('');
    this.recherche.set('');
  }

  // ── Affichage ──
  libelleGroupe(g: Groupe): string {
    return GROUPES.find(x => x.code === g)?.libelle ?? g;
  }

  iconeGroupe(g: Groupe): string {
    return GROUPES.find(x => x.code === g)?.icone ?? 'fa-circle';
  }

  private libelleStatutPph(s: string): string {
    return ({ BROUILLON: 'brouillon', VALIDE: 'validé', EN_COURS: 'en cours', CLOTURE: 'clôturé' } as Record<string, string>)[s] ?? s;
  }

  fr(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  kg(v: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} kg`;
  }
}
