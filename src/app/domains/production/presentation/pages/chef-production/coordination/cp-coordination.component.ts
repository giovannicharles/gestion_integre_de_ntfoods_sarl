import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ProductionService, AffectationBE, SessionBroyageBE, SessionDosageBE
} from '../../../../infrastructure/production.service';

type Onglet = 'salle' | 'machiniste' | 'doseur';
type Statut = 'TOUS' | 'BROUILLON' | 'VALIDEE' | 'OUVERTE' | 'CLOTUREE';

/** Date au format yyyy-mm-dd en heure locale (évite le décalage de toISOString le soir). */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Date saisie yyyy-mm-dd décalée de n jours, en heure locale. */
function decalerJours(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formaterDate(new Date(y, m - 1, d + n));
}

/**
 * COORDINATION DES ACTEURS — Chef de Production.
 * Activité d'une journée pour chaque rôle opérationnel : Responsable Salle
 * (affectations), Chef Machiniste (broyage), Agent Doseur (dosage).
 * Chaque source se charge indépendamment : une erreur sur l'une n'efface pas les autres.
 */
@Component({
  selector: 'app-cp-coordination',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './cp-coordination.component.html',
  styleUrls: ['./cp-coordination.component.css', '../_shared.css']
})
export class CpCoordinationComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  /** Garde : seule la dernière requête de chargement peut écrire dans l'état. */
  private requete = 0;

  readonly aujourdhui = formaterDate(new Date());
  jour = signal(this.aujourdhui);

  onglet = signal<Onglet>('salle');
  recherche = signal('');
  statut = signal<Statut>('TOUS');

  affectations = signal<AffectationBE[]>([]);
  sessionsBroyage = signal<SessionBroyageBE[]>([]);
  sessionsDosage = signal<SessionDosageBE[]>([]);

  /** Nombre de sources encore en attente. */
  enAttente = signal(0);
  chargement = computed(() => this.enAttente() > 0);
  erreurs = signal<Partial<Record<Onglet, string>>>({});
  derniereMaj = signal<Date | null>(null);

  readonly onglets: { code: Onglet; libelle: string; icone: string }[] = [
    { code: 'salle', libelle: 'Responsable Salle', icone: 'fa-user-gear' },
    { code: 'machiniste', libelle: 'Chef Machiniste', icone: 'fa-gears' },
    { code: 'doseur', libelle: 'Agent Doseur', icone: 'fa-flask' },
  ];

  /** Filtres de statut propres à chaque onglet. */
  readonly statutsParOnglet: Record<Onglet, { code: Statut; libelle: string }[]> = {
    salle: [
      { code: 'TOUS', libelle: 'Toutes' },
      { code: 'BROUILLON', libelle: 'Brouillon' },
      { code: 'VALIDEE', libelle: 'Validées' },
    ],
    machiniste: [
      { code: 'TOUS', libelle: 'Toutes' },
      { code: 'OUVERTE', libelle: 'Ouvertes' },
      { code: 'CLOTUREE', libelle: 'Clôturées' },
    ],
    doseur: [
      { code: 'TOUS', libelle: 'Tous' },
      { code: 'OUVERTE', libelle: 'Ouverts' },
      { code: 'CLOTUREE', libelle: 'Clôturés' },
    ],
  };

  pillesStatut = computed(() => this.statutsParOnglet[this.onglet()]);

  estAujourdhui = computed(() => this.jour() === this.aujourdhui);

  erreurOngletCourant = computed(() => this.erreurs()[this.onglet()] ?? '');

  // ── Compteurs par statut (sur les données brutes, indépendantes de la recherche) ──
  compteStatut = (code: Statut): number => {
    switch (this.onglet()) {
      case 'salle':
        return code === 'TOUS' ? this.affectations().length : this.affectations().filter(a => a.statut === code).length;
      case 'machiniste':
        return code === 'TOUS' ? this.sessionsBroyage().length : this.sessionsBroyage().filter(s => s.statut === code).length;
      default:
        return code === 'TOUS' ? this.sessionsDosage().length
          : this.sessionsDosage().filter(s => (code === 'CLOTUREE') === s.cloturee).length;
    }
  };

  // ── Listes affichées ──
  affectationsFiltrees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const s = this.statut();
    return this.affectations()
      .filter(a => s === 'TOUS' || a.statut === s)
      .filter(a => !q || a.referencePPH.toLowerCase().includes(q) || a.matriculeAgent.toLowerCase().includes(q));
  });

  broyageFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const s = this.statut();
    return this.sessionsBroyage()
      .filter(x => s === 'TOUS' || x.statut === s)
      .filter(x => !q
        || x.referencePPH.toLowerCase().includes(q)
        || x.typePoudreLibelle.toLowerCase().includes(q)
        || x.matriculeChefMachiniste.toLowerCase().includes(q));
  });

  dosageFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const s = this.statut();
    return this.sessionsDosage()
      .filter(x => s === 'TOUS' || (s === 'CLOTUREE') === x.cloturee)
      .filter(x => !q
        || x.referencePPH.toLowerCase().includes(q)
        || x.matriculeAgentDoseur.toLowerCase().includes(q));
  });

  // ── Indicateurs de l'onglet courant ──
  kpis = computed<{ libelle: string; valeur: string; detail: string; alerte?: boolean }[]>(() => {
    switch (this.onglet()) {
      case 'salle': {
        const lignes = this.affectations().flatMap(a => a.lignes);
        const reel = lignes.reduce((t, l) => t + l.effectifReel, 0);
        const ref = lignes.reduce((t, l) => t + l.effectifReference, 0);
        const sousEffectif = lignes.filter(l => l.effectifReel < l.effectifReference).length;
        return [
          { libelle: 'Affectations', valeur: String(this.affectations().length), detail: `${this.affectations().filter(a => a.statut === 'VALIDEE').length} validée(s)` },
          { libelle: 'Effectif présent', valeur: `${reel}`, detail: `sur ${ref} prévu(s)`, alerte: reel < ref },
          { libelle: 'Postes en sous-effectif', valeur: String(sousEffectif), detail: 'effectif réel < référence', alerte: sousEffectif > 0 },
        ];
      }
      case 'machiniste': {
        const realise = this.sessionsBroyage().reduce((t, s) => t + s.totalRealiseKg, 0);
        const objectif = this.sessionsBroyage().reduce((t, s) => t + s.objectifJournalierKg, 0);
        return [
          { libelle: 'Sessions', valeur: String(this.sessionsBroyage().length), detail: `${this.sessionsBroyage().filter(s => s.statut === 'OUVERTE').length} ouverte(s)` },
          { libelle: 'Broyé', valeur: `${this.formaterKg(realise)} kg`, detail: `sur ${this.formaterKg(objectif)} kg visés` },
          { libelle: 'Journées validées', valeur: String(this.sessionsBroyage().filter(s => s.journeeValidee).length), detail: 'sessions de broyage' },
        ];
      }
      default: {
        const nets = this.sessionsDosage().reduce((t, s) => t + s.nbFutsNets, 0);
        const casses = this.sessionsDosage().reduce((t, s) => t + s.nbFutsCasses, 0);
        const enPause = this.sessionsDosage().filter(s => s.enPause).length;
        return [
          { libelle: 'Sessions', valeur: String(this.sessionsDosage().length), detail: `${this.sessionsDosage().filter(s => !s.cloturee).length} ouverte(s)` },
          { libelle: 'Fûts nets', valeur: String(nets), detail: `${casses} cassé(s)`, alerte: casses > 0 },
          { libelle: 'En pause', valeur: String(enPause), detail: 'sessions suspendues', alerte: enPause > 0 },
        ];
      }
    }
  });

  ngOnInit(): void { this.charger(); }

  /** Change de jour (-1, +1) ou revient à aujourd'hui (0). */
  naviguer(pas: number): void {
    this.jour.set(pas === 0 ? this.aujourdhui : decalerJours(this.jour(), pas));
    this.charger();
  }

  /** Saisie directe d'une date (champ date). */
  allerA(valeur: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return;
    this.jour.set(valeur);
    this.charger();
  }

  changerOnglet(o: Onglet): void {
    this.onglet.set(o);
    this.statut.set('TOUS');
  }

  charger(): void {
    const id = ++this.requete;
    const jour = this.jour();
    this.enAttente.set(3);
    this.erreurs.set({});

    const termine = (source: Onglet, erreur?: string) => {
      if (id !== this.requete) return;
      if (erreur) this.erreurs.update(e => ({ ...e, [source]: erreur }));
      this.enAttente.update(n => n - 1);
      if (this.enAttente() === 0) this.derniereMaj.set(new Date());
    };
    const messageErreur = (e: any) => e?.error?.erreur || e?.error?.message || 'Chargement impossible.';

    this.svc.getAffectations({ debut: jour, fin: jour }).subscribe({
      next: a => { if (id === this.requete) this.affectations.set(a); termine('salle'); },
      error: e => { if (id === this.requete) this.affectations.set([]); termine('salle', messageErreur(e)); },
    });
    this.svc.getSessionsBroyage({ debut: jour, fin: jour }).subscribe({
      next: s => { if (id === this.requete) this.sessionsBroyage.set(s); termine('machiniste'); },
      error: e => { if (id === this.requete) this.sessionsBroyage.set([]); termine('machiniste', messageErreur(e)); },
    });
    this.svc.getSessionsDosageParDate(jour).subscribe({
      next: s => { if (id === this.requete) this.sessionsDosage.set(s); termine('doseur'); },
      error: e => { if (id === this.requete) this.sessionsDosage.set([]); termine('doseur', messageErreur(e)); },
    });
  }

  // ── Affichage ──
  saisiePourPoste(a: AffectationBE, codePoste: string) {
    return a.saisies.find(s => s.codePoste === codePoste) ?? null;
  }

  effectifEcart(l: AffectationBE['lignes'][number]): boolean {
    return l.effectifReel !== l.effectifReference;
  }

  pourcentage(valeur: number, total: number): number {
    return total > 0 ? Math.min(100, Math.round((valeur / total) * 100)) : 0;
  }

  formaterKg(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
  }

  libelleStatutAffectation(s: string): string {
    return s === 'VALIDEE' ? 'Validée' : s === 'BROUILLON' ? 'Brouillon' : s;
  }
}
