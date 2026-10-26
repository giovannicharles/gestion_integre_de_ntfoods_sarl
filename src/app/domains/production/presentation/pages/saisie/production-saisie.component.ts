import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ProductionService, SessionBroyageBE, SessionDosageBE, AffectationBE } from '../../../infrastructure/production.service';
import { ProductionRoleService } from '../../../infrastructure/production-role.service';

type Registre = 'broyage' | 'dosage' | 'affectations';
type Statut = 'TOUS' | 'OUVERTE' | 'CLOTUREE' | 'BROUILLON' | 'VALIDEE';

/** Date au format yyyy-mm-dd en heure locale (évite le décalage de toISOString le soir). */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function decalerJours(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formaterDate(new Date(y, m - 1, d + n));
}

/**
 * REGISTRES JOURNALIERS — consultation des sessions de broyage, de dosage et des affectations.
 *
 * Le Chef de Production consulte seulement : la page ne propose aucune saisie.
 * Seul le Responsable de Salle et l'Admin peuvent valider une affectation depuis ici.
 */
@Component({
  selector: 'app-production-saisie',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './production-saisie.component.html',
  styleUrls: ['./production-saisie.component.css']
})
export class ProductionSaisieComponent implements OnInit {
  private readonly prodSvc = inject(ProductionService);
  private readonly roles = inject(ProductionRoleService);

  private requete = 0;

  readonly aujourdhui = formaterDate(new Date());
  jour = signal(this.aujourdhui);
  estAujourdhui = computed(() => this.jour() === this.aujourdhui);

  /** Consultation seule pour tout rôle hors Responsable de Salle et Admin. */
  peutValider = computed(() => this.roles.hasRole('RESPONSABLE_SALLE', 'ADMIN'));
  lectureSeule = computed(() => !this.peutValider());

  registre = signal<Registre>('broyage');
  recherche = signal('');
  statut = signal<Statut>('TOUS');

  broyage = signal<SessionBroyageBE[]>([]);
  dosage = signal<SessionDosageBE[]>([]);
  affectations = signal<AffectationBE[]>([]);

  enAttente = signal(0);
  chargement = computed(() => this.enAttente() > 0);
  erreurs = signal<Partial<Record<Registre, string>>>({});
  derniereMaj = signal<Date | null>(null);

  message = signal<{ type: 'ok' | 'erreur'; texte: string } | null>(null);
  affectationDetail = signal<AffectationBE | null>(null);

  readonly registres: { code: Registre; libelle: string; icone: string }[] = [
    { code: 'broyage', libelle: 'Broyage', icone: 'fa-gears' },
    { code: 'dosage', libelle: 'Dosage', icone: 'fa-fill-drip' },
    { code: 'affectations', libelle: 'Affectations', icone: 'fa-users-gear' },
  ];

  readonly statutsParRegistre: Record<Registre, { code: Statut; libelle: string }[]> = {
    broyage: [
      { code: 'TOUS', libelle: 'Toutes' },
      { code: 'OUVERTE', libelle: 'Ouvertes' },
      { code: 'CLOTUREE', libelle: 'Clôturées' },
    ],
    dosage: [
      { code: 'TOUS', libelle: 'Tous' },
      { code: 'OUVERTE', libelle: 'Ouverts' },
      { code: 'CLOTUREE', libelle: 'Clôturés' },
    ],
    affectations: [
      { code: 'TOUS', libelle: 'Toutes' },
      { code: 'BROUILLON', libelle: 'Brouillon' },
      { code: 'VALIDEE', libelle: 'Validées' },
    ],
  };

  pillesStatut = computed(() => this.statutsParRegistre[this.registre()]);

  compteStatut = (code: Statut): number => {
    switch (this.registre()) {
      case 'broyage': return code === 'TOUS' ? this.broyage().length : this.broyage().filter(s => s.statut === code).length;
      case 'dosage': return code === 'TOUS' ? this.dosage().length : this.dosage().filter(s => (code === 'CLOTUREE') === s.cloturee).length;
      default: return code === 'TOUS' ? this.affectations().length : this.affectations().filter(a => a.statut === code).length;
    }
  };

  // ── Listes affichées ──
  broyageFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const s = this.statut();
    return this.broyage()
      .filter(x => s === 'TOUS' || x.statut === s)
      .filter(x => !q || x.referencePPH.toLowerCase().includes(q)
        || x.typePoudreLibelle.toLowerCase().includes(q)
        || x.matriculeChefMachiniste.toLowerCase().includes(q));
  });

  dosageFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const s = this.statut();
    return this.dosage()
      .filter(x => s === 'TOUS' || (s === 'CLOTUREE') === x.cloturee)
      .filter(x => !q || x.referencePPH.toLowerCase().includes(q) || x.matriculeAgentDoseur.toLowerCase().includes(q));
  });

  affectationsFiltrees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const s = this.statut();
    return this.affectations()
      .filter(a => s === 'TOUS' || a.statut === s)
      .filter(a => !q || a.referencePPH.toLowerCase().includes(q) || a.matriculeAgent.toLowerCase().includes(q));
  });

  // ── Indicateurs de la journée consultée ──
  kpis = computed<{ libelle: string; valeur: string; detail: string; alerte?: boolean }[]>(() => {
    const brutes = this.broyage();
    const kgNets = brutes.reduce((t, s) => t + (s.quantiteNetteBroyeeKg ?? 0), 0);
    const pertes = brutes.map(s => s.pctPertes).filter((p): p is number => p != null);
    const perteMoy = pertes.length ? pertes.reduce((t, p) => t + p, 0) / pertes.length : null;
    const futs = this.dosage().reduce((t, s) => t + s.nbFutsProduits, 0);
    const validees = this.affectations().filter(a => a.statut === 'VALIDEE').length;
    return [
      { libelle: 'Broyé (net)', valeur: `${this.formaterKg(kgNets)} kg`, detail: `${brutes.length} session(s) de broyage` },
      { libelle: 'Perte moyenne', valeur: perteMoy == null ? '—' : this.formaterPct(perteMoy), detail: 'moyenne des sessions', alerte: perteMoy != null && perteMoy > 5 },
      { libelle: 'Fûts dosés', valeur: String(futs), detail: `${this.dosage().length} session(s) de dosage` },
      { libelle: 'Affectations validées', valeur: `${validees} / ${this.affectations().length}`, detail: 'pour la journée' },
    ];
  });

  ngOnInit(): void { this.charger(); }

  naviguer(pas: number): void {
    this.jour.set(pas === 0 ? this.aujourdhui : decalerJours(this.jour(), pas));
    this.charger();
  }

  allerA(valeur: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur) || valeur > this.aujourdhui) return;
    this.jour.set(valeur);
    this.charger();
  }

  changerRegistre(r: Registre): void {
    this.registre.set(r);
    this.statut.set('TOUS');
  }

  charger(): void {
    const id = ++this.requete;
    const jour = this.jour();
    this.enAttente.set(3);
    this.erreurs.set({});

    const termine = (source: Registre, erreur?: string) => {
      if (id !== this.requete) return;
      if (erreur) this.erreurs.update(e => ({ ...e, [source]: erreur }));
      this.enAttente.update(n => n - 1);
      if (this.enAttente() === 0) this.derniereMaj.set(new Date());
    };
    const messageErreur = (e: any) => e?.error?.erreur || e?.error?.message || 'Chargement impossible.';

    this.prodSvc.getSessionsBroyage({ debut: jour, fin: jour }).subscribe({
      next: b => { if (id === this.requete) this.broyage.set(b); termine('broyage'); },
      error: e => { if (id === this.requete) this.broyage.set([]); termine('broyage', messageErreur(e)); },
    });
    this.prodSvc.getSessionsDosageParDate(jour).subscribe({
      next: d => { if (id === this.requete) this.dosage.set(d); termine('dosage'); },
      error: e => { if (id === this.requete) this.dosage.set([]); termine('dosage', messageErreur(e)); },
    });
    this.prodSvc.getAffectations({ debut: jour, fin: jour }).subscribe({
      next: a => { if (id === this.requete) this.affectations.set(a); termine('affectations'); },
      error: e => { if (id === this.requete) this.affectations.set([]); termine('affectations', messageErreur(e)); },
    });
  }

  validerAffectation(a: AffectationBE): void {
    if (!this.peutValider()) return;
    this.prodSvc.validerAffectation(a.id).subscribe({
      next: v => {
        this.affectations.update(liste => liste.map(x => x.id === v.id ? v : x));
        this.message.set({ type: 'ok', texte: `Affectation ${v.referencePPH} validée.` });
      },
      error: e => this.message.set({ type: 'erreur', texte: e?.error?.erreur || e?.error?.message || 'Validation impossible.' }),
    });
  }

  ouvrirDetail(a: AffectationBE): void { this.affectationDetail.set(a); }

  @HostListener('document:keydown.escape')
  fermerDetail(): void { this.affectationDetail.set(null); }

  saisiePourPoste(a: AffectationBE, codePoste: string) {
    return a.saisies.find(s => s.codePoste === codePoste) ?? null;
  }

  pourcentage(valeur: number, total: number): number {
    return total > 0 ? Math.min(100, Math.round((valeur / total) * 100)) : 0;
  }

  formaterKg(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
  }

  formaterPct(v: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} %`;
  }

  libelleStatutAffectation(s: string): string {
    return s === 'VALIDEE' ? 'Validée' : s === 'BROUILLON' ? 'Brouillon' : s;
  }
}
