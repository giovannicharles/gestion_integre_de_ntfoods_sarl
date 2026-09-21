import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionDosageBE, PPHBE, PredictionProduitFiniBE } from '../../../../infrastructure/production.service';
import { AdSessionContextService } from '../ad-session-context.service';
import { AuthService } from '../../../../../../core/auth/auth.service';

type TypeMelange = 'BOUILLIE' | 'ARACHIDE';
type Etape = 1 | 2 | 3 | 4 | 5;

/**
 * MA SESSION DU JOUR — Agent Doseur (écran unique guidé)
 *
 * Réunit en un seul assistant pas-à-pas tout le travail d'une session de dosage,
 * qui était auparavant éclaté sur 6 écrans (Sessions, Dosage, Machines, Fûts,
 * Prédictions, Documents) :
 *   1. Ma session   → ouvrir / reprendre la session du jour
 *   2. Dosage       → formule (Bouillie / Arachide) + nb fûts, matières auto
 *   3. Fûts         → nombre de fûts sortis
 *   4. Machines     → machines mobilisées (optionnel)
 *   5. Terminer     → estimation produits finis, registre, clôture
 *
 * Toutes les données passent exclusivement par ProductionService.
 */
@Component({
  selector: 'app-ad-session-jour',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './ad-session-jour.component.html',
  styleUrls: ['./ad-session-jour.component.css', '../_shared.css'],
})
export class AdSessionJourComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ProductionService);
  private readonly auth = inject(AuthService);
  readonly contexte = inject(AdSessionContextService);

  // ── État global de l'assistant ──────────────────────────────────────
  etape = signal<Etape>(1);
  message = signal('');
  erreur = signal('');
  chargement = signal(false);
  enregistre = signal(false);           // pastille « enregistré » du dosage auto
  today = this.contexte.today;

  /** La session en cours de travail (mise à jour à chaque réponse serveur). */
  session = signal<SessionDosageBE | null>(null);

  /** Résumé de la session affiché dans l'en-tête. */
  sessionInfo = computed(() => {
    const s = this.session();
    if (!s) return null;
    return {
      id: s.id,
      referencePPH: s.referencePPH,
      date: s.date,
      nbFuts: s.nbFutsProduits,
      nbMatières: s.matieresUtilisees.length,
      nbMachines: s.machinesMobilisees.length,
      validee: s.validee,
      cloturee: s.cloturee,
      enPause: s.enPause,
    };
  });

  sessionModifiable = computed(() => {
    const s = this.session();
    return !!s && !s.validee && !s.cloturee && !s.enPause;
  });

  // ── Étape 1 : ouverture ─────────────────────────────────────────────
  pphs = signal<PPHBE[]>([]);
  referencePPH = '';
  get matricule(): string { return this.auth.user()?.matricule ?? ''; }

  // ── Étape 2 : dosage ────────────────────────────────────────────────
  typeMelange: TypeMelange = 'BOUILLIE';
  nbFuts = 1;
  private autoSave: ReturnType<typeof setTimeout> | null = null;

  /** Quantités de matières premières pour le nombre de fûts choisi. */
  quantites = computed(() => {
    const n = this.nbFuts || 0;
    return this.typeMelange === 'BOUILLIE'
      ? { mais: 40 * n, soja: 9 * n, arachide: 1 * n }
      : { mais: 40 * n, soja: 1 * n, arachide: 9 * n };
  });

  /** Total de poudre prévue par le dosage automatique. */
  poidsTotalPoudre = computed(() => this.quantites().mais + this.quantites().soja + this.quantites().arachide);

  // ── Étape 3 : fûts ──────────────────────────────────────────────────
  /** Nombre de fûts sortis = fûts produits (règle métier). */
  nbProduits = 0;
  futsNets = computed(() => Math.max(0, this.nbProduits));

  // ── Étape 4 : machines ──────────────────────────────────────────────
  nouvelleMachine = '';

  // ── Étape 5 : prédiction ────────────────────────────────────────────
  prediction = signal<PredictionProduitFiniBE | null>(null);
  terminee = signal(false);

  // ── Cycle de vie ────────────────────────────────────────────────────
  ngOnInit(): void {
    this.svc.getPPHs().subscribe({
      next: list => {
        // On propose en priorité les plans exploitables (en cours / validés).
        const utiles = list.filter(p => p.statut === 'EN_COURS' || p.statut === 'VALIDE');
        this.pphs.set(utiles.length ? utiles : list);
        if (this.pphs().length === 1) this.referencePPH = this.pphs()[0].referencePPH;
      },
    });
    this.svc.getSessionsDosageParDate(this.today).subscribe({
      next: sessions => {
        const active = sessions.find(s => !s.cloturee && !s.validee) ?? null;
        if (active) {
          this.reprendre(active);
          this.etape.set(2);            // on reprend directement au dosage
        }
      },
    });
  }

  ngOnDestroy(): void {
    if (this.autoSave) clearTimeout(this.autoSave);
  }

  // ── Navigation ──────────────────────────────────────────────────────
  aller(e: Etape): void { this.message.set(''); this.erreur.set(''); this.etape.set(e); }
  peutAcceder(e: Etape): boolean { return e === 1 || this.session() != null; }

  // ── Étape 1 : ouvrir / reprendre ────────────────────────────────────
  private reprendre(s: SessionDosageBE): void {
    this.session.set(s);
    this.contexte.definir(s.id, s.referencePPH, s.date);
    this.referencePPH = s.referencePPH;
    this.nbProduits = s.nbFutsProduits;
    // On récupère le nombre de fûts prévu par le dosage existant (40 kg de maïs par fût).
    const mais = s.matieresUtilisees.find(m => m.typeMatiere === 'MAIS')?.quantiteKg ?? 0;
    this.nbFuts = Math.max(1, Math.round(mais / 40));
    // Si des matières existent, on considère que le dosage est enregistré.
    this.enregistre.set(s.matieresUtilisees.length > 0);
  }

  ouvrir(): void {
    if (!this.referencePPH) { this.erreur.set('Choisissez d’abord un plan de production (PPH).'); return; }
    if (!this.matricule) { this.erreur.set('Votre matricule agent est introuvable — reconnectez-vous.'); return; }
    this.chargement.set(true);
    this.svc.ouvrirSessionDosage({
      referencePPH: this.referencePPH, date: this.today, matriculeAgentDoseur: this.matricule,
    }).subscribe({
      next: s => {
        this.reprendre(s);
        this.chargement.set(false);
        this.message.set('Session ouverte. Passons au dosage.');
        this.aller(2);
      },
      error: () => {
        this.chargement.set(false);
        // Si l'ouverture échoue, on recharge les sessions existantes pour afficher celle déjà ouverte.
        this.svc.getSessionsDosageParDate(this.today).subscribe({
          next: sessions => {
            const active = sessions.find(s => !s.cloturee && !s.validee) ?? null;
            if (active) {
              this.reprendre(active);
              this.message.set('Une session existante a été retrouvée et rechargée.');
              this.aller(2);
            } else {
              this.erreur.set("Impossible d’ouvrir la session. Une session est peut-être déjà ouverte, ou une erreur technique est survenue.");
            }
          },
          error: () => this.erreur.set("Impossible d’ouvrir la session. Une session est peut-être déjà ouverte."),
        });
      },
    });
  }

  // ── Étape 2 : dosage automatique ────────────────────────────────────
  choisirMelange(t: TypeMelange): void { this.typeMelange = t; this.declencherDosage(); }
  incrementerFuts(delta: number): void { this.nbFuts = Math.max(0, this.nbFuts + delta); this.declencherDosage(); }

  declencherDosage(): void {
    const s = this.session();
    if (!s || this.nbFuts < 0) return;
    this.enregistre.set(false);
    if (this.autoSave) clearTimeout(this.autoSave);
    this.autoSave = setTimeout(() => this.appliquerDosage(), 500);
  }

  private appliquerDosage(): void {
    const s = this.session();
    if (!s) return;
    this.svc.mettreAJourDosageAutomatique(s.id, this.nbFuts, this.typeMelange).subscribe({
      next: maj => { this.session.set(maj); this.enregistre.set(true); },
      error: () => this.erreur.set('Le dosage n’a pas pu être enregistré. Réessayez.'),
    });
  }

  // ── Étape 3 : fûts ──────────────────────────────────────────────────
  incrementerProduits(delta: number): void { this.nbProduits = Math.max(0, this.nbProduits + delta); }

  validerFuts(): void {
    const s = this.session();
    if (!s || this.nbProduits <= 0) { this.erreur.set('Indiquez au moins un fût sorti.'); return; }
    this.chargement.set(true);
    this.svc.enregistrerFutsDosage(s.id, this.nbProduits).subscribe({
      next: maj => {
        this.session.set(maj);
        this.nbFuts = maj.nbFutsProduits;     // synchronise le dosage avec les fûts réellement sortis
        this.declencherDosage();              // recalcule les matières pour ce nombre exact
        this.chargement.set(false);
        this.message.set(`${maj.nbFutsNets} fûts sortis enregistrés.`);
        this.aller(4);
      },
      error: () => { this.chargement.set(false); this.erreur.set("Les fûts n’ont pas pu être enregistrés."); },
    });
  }

  // ── Étape 4 : machines ──────────────────────────────────────────────
  ajouterMachine(): void {
    const s = this.session();
    const id = this.nouvelleMachine.trim();
    if (!s || !id) { this.erreur.set('Saisissez l’identifiant de la machine.'); return; }
    this.chargement.set(true);
    this.svc.enregistrerMachineDosage(s.id, id).subscribe({
      next: maj => {
        this.session.set(maj);
        this.nouvelleMachine = '';
        this.chargement.set(false);
        this.message.set(`Machine ${id} ajoutée.`);
      },
      error: () => { this.chargement.set(false); this.erreur.set("La machine n’a pas pu être ajoutée."); },
    });
  }

  // ── Étape 5 : estimation, registre, clôture ─────────────────────────
  calculerPrediction(): void {
    const s = this.session();
    if (!s) return;
    if (s.nbFutsNets <= 0) { this.message.set('Enregistrez d’abord les fûts pour obtenir une estimation.'); return; }
    this.chargement.set(true);
    this.svc.predireProduitFini(s.id).subscribe({
      next: p => { this.prediction.set(p); this.chargement.set(false); },
      error: () => { this.chargement.set(false); this.erreur.set('Estimation indisponible pour cette session.'); },
    });
  }

  telechargerRegistre(): void {
    const s = this.session();
    if (!s) return;
    this.svc.telechargerRegistreDosage(s.id, 'pdf').subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `registre-dosage-${s.id}.pdf`; a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.erreur.set('Téléchargement du registre impossible.'),
    });
  }

  cloturer(): void {
    const s = this.session();
    if (!s) return;
    if (!confirm('Clôturer définitivement la session du jour ?')) return;
    this.chargement.set(true);
    this.svc.cloturerSessionDosage(s.id).subscribe({
      next: () => {
        this.chargement.set(false);
        this.terminee.set(true);
        this.contexte.effacer();
        this.contexte.chargerSessionsOuvertes(true);
      },
      error: () => { this.chargement.set(false); this.erreur.set('La clôture a échoué. Réessayez.'); },
    });
  }

  mettreEnPause(): void {
    const s = this.session();
    if (!s) return;
    if (!confirm('Mettre la session en pause ? Aucune modification ne sera possible jusqu’à la reprise.')) return;
    this.chargement.set(true);
    this.svc.mettreEnPauseSessionDosage(s.id).subscribe({
      next: maj => {
        this.session.set(maj);
        this.chargement.set(false);
        this.message.set('Session mise en pause.');
      },
      error: () => { this.chargement.set(false); this.erreur.set('La mise en pause a échoué.'); },
    });
  }

  reprendreActivite(): void {
    const s = this.session();
    if (!s) return;
    this.chargement.set(true);
    this.svc.reprendreSessionDosage(s.id).subscribe({
      next: maj => {
        this.session.set(maj);
        this.chargement.set(false);
        this.message.set('Session reprise. Vous pouvez modifier à nouveau.');
      },
      error: () => { this.chargement.set(false); this.erreur.set('La reprise a échoué.'); },
    });
  }

  recommencer(): void {
    this.session.set(null); this.prediction.set(null); this.terminee.set(false);
    this.referencePPH = ''; this.typeMelange = 'BOUILLIE'; this.nbFuts = 1;
    this.nbProduits = 0; this.nouvelleMachine = '';
    this.message.set(''); this.erreur.set('');
    this.etape.set(1);
  }
}
