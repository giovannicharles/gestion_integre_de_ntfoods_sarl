import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of, Observable, catchError, map } from 'rxjs';
import {
  ProductionService, OFBE, SessionBroyageBE, SessionDosageBE, ExpressionBesoinBE, LotBE, PPHBE,
  RegistreProductionBE, AffectationBE
} from '../../../../infrastructure/production.service';

type TypeAlerte = 'of' | 'broyage' | 'dosage' | 'besoin' | 'lot' | 'saisie';
type Gravite = 'critique' | 'attention';

interface Alerte {
  id: string;
  type: TypeAlerte;
  gravite: Gravite;
  titre: string;
  detail: string;
  date: string;
  lien: string;
  libelleLien: string;
}

/** Seuils : au-delà, une alerte est levée. Ce sont des valeurs de contrôle, pas des données persistées. */
const SEUIL_PERTES_CRITIQUE = 15;
const JOURS_LOT_EN_ATTENTE = 2;
const JOURS_BESOIN_EN_ATTENTE = 1;

/** Date au format yyyy-mm-dd en heure locale. */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Nombre de jours entiers entre une date yyyy-mm-dd et aujourd'hui. */
function joursDepuis(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = formaterDate(new Date()).split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000);
}

/**
 * ALERTES — Chef de Production.
 * Calculées à la lecture à partir des données réelles : aucune alerte n'est enregistrée,
 * donc rien ne peut être « clôturé » ici. L'action se fait sur l'objet concerné, via le lien.
 */
@Component({
  selector: 'app-cp-alertes',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './cp-alertes.component.html',
  styleUrls: ['./cp-alertes.component.css']
})
export class CpAlertesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = formaterDate(new Date());
  chargement = signal(false);
  derniereMaj = signal<Date | null>(null);
  erreurs = signal<string[]>([]);
  private requete = 0;

  ofs = signal<OFBE[]>([]);
  sessionsBroyage = signal<SessionBroyageBE[]>([]);
  sessionsDosage = signal<SessionDosageBE[]>([]);
  besoins = signal<ExpressionBesoinBE[]>([]);
  lots = signal<LotBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  registresDuJour = signal<RegistreProductionBE[]>([]);
  affectationsDuJour = signal<AffectationBE[]>([]);

  // ── Filtres ──
  filtreType = signal<TypeAlerte | ''>('');
  filtreGravite = signal<Gravite | ''>('');
  recherche = signal('');

  readonly types: { code: TypeAlerte; libelle: string }[] = [
    { code: 'of', libelle: 'Ordres de fabrication' },
    { code: 'broyage', libelle: 'Broyage' },
    { code: 'dosage', libelle: 'Dosage' },
    { code: 'besoin', libelle: 'Besoins' },
    { code: 'lot', libelle: 'Lots' },
    { code: 'saisie', libelle: 'Saisie du jour' },
  ];

  // ── Calcul des alertes ──
  alertes = computed<Alerte[]>(() => {
    const liste: Alerte[] = [];
    const aujourd = this.aujourdhui;

    // OF : échéance dépassée, et production au-delà de la demande
    for (const o of this.ofs()) {
      if (o.statut !== 'HONORE' && o.statut !== 'ANNULE' && o.dateButoir && o.dateButoir < aujourd) {
        liste.push({
          id: `of-retard-${o.idOF}`, type: 'of', gravite: 'critique',
          titre: `OF ${o.idOF} en retard`,
          detail: `${o.designationProduit} — échéance le ${o.dateButoir.slice(8, 10)}/${o.dateButoir.slice(5, 7)}, ${o.qteRealisee}/${o.qteDemandee} réalisé`,
          date: o.dateButoir, lien: '/production/chef-production/suivi-global', libelleLien: 'Voir le suivi',
        });
      }
      if (o.qteRealisee > o.qteDemandee) {
        liste.push({
          id: `of-depassement-${o.idOF}`, type: 'of', gravite: 'attention',
          titre: `OF ${o.idOF} dépassé`,
          detail: `${o.qteRealisee} produit(s) pour ${o.qteDemandee} demandé(s) — ${o.designationProduit}`,
          date: aujourd, lien: '/production/chef-production/suivi-global', libelleLien: 'Voir le suivi',
        });
      }
    }

    // Broyage : pertes critiques, et journée clôturée sans objectif atteint
    for (const s of this.sessionsBroyage()) {
      if ((s.pctPertes ?? 0) > SEUIL_PERTES_CRITIQUE) {
        liste.push({
          id: `broyage-pertes-${s.id}`, type: 'broyage', gravite: 'critique',
          titre: `Pertes élevées — ${s.typePoudreLibelle}`,
          detail: `${this.pct(s.pctPertes ?? 0)} de pertes (PPH ${s.referencePPH}, machiniste ${s.matriculeChefMachiniste})`,
          date: s.date, lien: '/production/chef-production/performances', libelleLien: 'Voir les performances',
        });
      }
      if (!s.journeeValidee && s.statut === 'CLOTUREE') {
        liste.push({
          id: `broyage-objectif-${s.id}`, type: 'broyage', gravite: 'attention',
          titre: `Objectif non atteint — ${s.typePoudreLibelle}`,
          detail: `${s.referencePPH} : ${this.kg(s.totalRealiseKg)} sur ${this.kg(s.objectifJournalierKg)} prévus, journée non validée`,
          date: s.date, lien: '/production/chef-production/coordination', libelleLien: 'Voir la coordination',
        });
      }
    }

    // Dosage : écart justifié par l'agent
    for (const s of this.sessionsDosage()) {
      if (s.justificationEcart) {
        liste.push({
          id: `dosage-ecart-${s.id}`, type: 'dosage', gravite: 'attention',
          titre: `Écart de dosage justifié`,
          detail: `${s.referencePPH} — ${s.justificationEcart}`,
          date: s.date, lien: '/production/saisie', libelleLien: 'Voir les registres',
        });
      }
    }

    // Besoins : demandes non traitées
    for (const b of this.besoins()) {
      if (b.statut === 'EN_ATTENTE' && joursDepuis(b.dateCreation) >= JOURS_BESOIN_EN_ATTENTE) {
        liste.push({
          id: `besoin-${b.numero}`, type: 'besoin', gravite: 'attention',
          titre: `Besoin ${b.numero} en attente`,
          detail: `${b.designationProduit} — ${b.quantiteDemandee} ${b.unite}, signalé depuis ${joursDepuis(b.dateCreation)} j`,
          date: b.dateCreation.slice(0, 10), lien: '/production/besoins', libelleLien: 'Traiter le besoin',
        });
      }
    }

    // Lots : rejets du stock, et lots déclarés qui attendent trop longtemps
    for (const l of this.lots()) {
      if (l.statut === 'REJETE') {
        liste.push({
          id: `lot-rejet-${l.numeroLot}`, type: 'lot', gravite: 'critique',
          titre: `Lot ${l.numeroLot} rejeté par le stock`,
          detail: `${l.productName} — ${l.motifRejet || 'motif non renseigné'}`,
          date: l.dateProduction, lien: '/production/lots', libelleLien: 'Voir le lot',
        });
      } else if (l.statut === 'DECLARE' && joursDepuis(l.dateProduction) >= JOURS_LOT_EN_ATTENTE) {
        liste.push({
          id: `lot-attente-${l.numeroLot}`, type: 'lot', gravite: 'attention',
          titre: `Lot ${l.numeroLot} en attente de validation`,
          detail: `${l.productName} — ${l.declaredQuantityKg} kg déclarés il y a ${joursDepuis(l.dateProduction)} j`,
          date: l.dateProduction, lien: '/production/lots', libelleLien: 'Voir le lot',
        });
      }
    }

    // Saisie du jour : PPH en cours sans registre, affectation non validée
    const pphsEnCours = this.pphs().filter(p => p.statut === 'EN_COURS');
    const pphsAvecRegistre = new Set(this.registresDuJour().map(r => r.referencePPH));
    for (const p of pphsEnCours) {
      if (!pphsAvecRegistre.has(p.referencePPH)) {
        liste.push({
          id: `registre-${p.referencePPH}`, type: 'saisie', gravite: 'attention',
          titre: `Registre du jour manquant`,
          detail: `${p.referencePPH} est en cours de production mais aucun registre des employés n'a été enregistré aujourd'hui`,
          date: aujourd, lien: '/production/employes', libelleLien: 'Saisir le registre',
        });
      }
    }
    for (const a of this.affectationsDuJour()) {
      if (a.statut !== 'VALIDEE') {
        liste.push({
          id: `affectation-${a.id}`, type: 'saisie', gravite: 'attention',
          titre: `Affectation ${a.referencePPH} non validée`,
          detail: `${a.lignes.length} poste(s) affecté(s) aujourd'hui, pas encore validés par le responsable de salle`,
          date: aujourd, lien: '/production/saisie', libelleLien: 'Valider l\'affectation',
        });
      }
    }

    return liste.sort((a, b) => {
      if (a.gravite !== b.gravite) return a.gravite === 'critique' ? -1 : 1;
      return b.date.localeCompare(a.date);
    });
  });

  alertesFiltrees = computed(() => {
    const t = this.filtreType();
    const g = this.filtreGravite();
    const q = this.recherche().trim().toLowerCase();
    return this.alertes()
      .filter(a => !t || a.type === t)
      .filter(a => !g || a.gravite === g)
      .filter(a => !q || a.titre.toLowerCase().includes(q) || a.detail.toLowerCase().includes(q));
  });

  nbCritiques = computed(() => this.alertes().filter(a => a.gravite === 'critique').length);
  nbAttention = computed(() => this.alertes().filter(a => a.gravite === 'attention').length);

  compteType = (code: TypeAlerte): number => this.alertes().filter(a => a.type === code).length;

  // ── Chargement ──
  ngOnInit(): void { this.charger(); }

  charger(): void {
    const id = ++this.requete;
    this.chargement.set(true);
    const maintenant = new Date();
    const debut = new Date(maintenant); debut.setDate(debut.getDate() - 14);
    const debutS = formaterDate(debut);
    const finS = formaterDate(maintenant);

    // Chaque source a sa propre tolérance aux erreurs : une source en échec ne vide pas les autres.
    const garde = <T>(obs: Observable<T>, nom: string, vide: T) =>
      obs.pipe(
        map(v => ({ ok: true as const, v, nom })),
        catchError(() => of({ ok: false as const, v: vide, nom })),
      );

    forkJoin({
      ofs: garde(this.svc.getOFs(), 'ordres de fabrication', [] as OFBE[]),
      broyage: garde(this.svc.getSessionsBroyage({ debut: debutS, fin: finS }), 'sessions de broyage', [] as SessionBroyageBE[]),
      dosage: garde(this.svc.getSessionsDosageParPeriode(debutS, finS), 'sessions de dosage', [] as SessionDosageBE[]),
      besoins: garde(this.svc.getBesoins('EN_ATTENTE'), 'besoins', [] as ExpressionBesoinBE[]),
      lots: garde(this.svc.getLots(), 'lots', [] as LotBE[]),
      pphs: garde(this.svc.getPPHs(), 'PPH', [] as PPHBE[]),
      registres: garde(this.svc.getRegistres({ debut: this.aujourdhui, fin: this.aujourdhui }), 'registres du jour', [] as RegistreProductionBE[]),
      affectations: garde(this.svc.getAffectations({ debut: this.aujourdhui, fin: this.aujourdhui }), 'affectations du jour', [] as AffectationBE[]),
    }).subscribe(r => {
      if (id !== this.requete) return;
      const toutes = Object.values(r);
      this.erreurs.set(toutes.filter(x => !x.ok).map(x => x.nom));
      this.ofs.set(r.ofs.v);
      this.sessionsBroyage.set(r.broyage.v);
      this.sessionsDosage.set(r.dosage.v);
      this.besoins.set(r.besoins.v);
      this.lots.set(r.lots.v);
      this.pphs.set(r.pphs.v);
      this.registresDuJour.set(r.registres.v);
      this.affectationsDuJour.set(r.affectations.v);
      this.chargement.set(false);
      this.derniereMaj.set(new Date());
    });
  }

  // ── Actions de la liste ──
  reinitialiser(): void {
    this.filtreType.set('');
    this.filtreGravite.set('');
    this.recherche.set('');
  }

  // ── Affichage ──
  icone(t: TypeAlerte): string {
    return ({ of: 'fa-industry', broyage: 'fa-gears', dosage: 'fa-fill-drip', besoin: 'fa-triangle-exclamation', lot: 'fa-boxes-packing', saisie: 'fa-pen-to-square' } as Record<TypeAlerte, string>)[t];
  }

  libelleType(t: TypeAlerte): string {
    return this.types.find(x => x.code === t)?.libelle ?? t;
  }

  pct(v: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} %`;
  }

  kg(v: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} kg`;
  }
}
