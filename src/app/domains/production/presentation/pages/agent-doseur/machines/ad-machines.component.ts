import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, SessionDosageBE } from '../../../../infrastructure/production.service';
import { AdSessionContextService } from '../ad-session-context.service';

/** Date au format yyyy-mm-dd en heure locale. */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Identifiant de machine tel qu'il est enregistré par le serveur (sans espaces, en majuscules). */
function codeMachine(id: string): string {
  return id.trim().toUpperCase();
}

/**
 * MACHINES DE DOSAGE — Agent Doseur.
 * Enregistre les machines mobilisées sur la session ouverte, et montre leur utilisation sur 14 jours.
 * Le backend ne trace ni durée ni horaire : seule la liste des machines par session existe.
 */
@Component({
  selector: 'app-ad-machines',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  templateUrl: './ad-machines.component.html',
  styleUrls: ['./ad-machines.component.css'],
})
export class AdMachinesComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  readonly contexte = inject(AdSessionContextService);

  readonly aujourdhui = formaterDate(new Date());
  loading = signal(true);
  erreur = signal('');
  sessionExpiree = signal(false);
  derniereMaj = signal<Date | null>(null);
  historique = signal<SessionDosageBE[]>([]);

  message = signal('');
  messageErreur = signal(false);
  enregistrement = signal(false);
  nouvelleMachineId = '';
  recherche = signal('');
  ouverte = signal<string | null>(null);

  /** Machines connues : sert de suggestion à la saisie. */
  machinesConnues = computed(() => this.utilisation().map(u => u.machine));

  /** Utilisation par machine sur la période : sessions, dernière date, et liste des sessions. */
  utilisation = computed(() => {
    const map = new Map<string, SessionDosageBE[]>();
    for (const s of this.historique()) {
      for (const m of s.machinesMobilisees) {
        const code = codeMachine(m);
        map.set(code, [...(map.get(code) ?? []), s]);
      }
    }
    return [...map.entries()]
      .map(([machine, sessions]) => ({
        machine,
        sessions: [...sessions].sort((a, b) => b.date.localeCompare(a.date)),
        derniere: sessions.reduce((max, s) => (s.date > max ? s.date : max), ''),
      }))
      .sort((a, b) => b.sessions.length - a.sessions.length || a.machine.localeCompare(b.machine));
  });

  utilisationFiltree = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.utilisation().filter(u => !q || u.machine.toLowerCase().includes(q));
  });

  // ── Indicateurs ──
  nbMachines = computed(() => this.utilisation().length);
  nbUtilisations = computed(() => this.utilisation().reduce((t, u) => t + u.sessions.length, 0));
  machinesAujourdhui = computed(() => {
    const s = this.contexte.sessionActive();
    return s ? s.machinesMobilisees.length : 0;
  });
  sessionsSansMachine = computed(() => this.historique().filter(s => s.machinesMobilisees.length === 0).length);

  ngOnInit(): void {
    this.contexte.chargerSessionsOuvertes();
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set('');
    this.sessionExpiree.set(false);
    const fin = this.aujourdhui;
    const d = new Date();
    d.setDate(d.getDate() - 13);
    this.svc.getSessionsDosageParPeriode(formaterDate(d), fin).subscribe({
      next: s => { this.historique.set(s); this.loading.set(false); this.derniereMaj.set(new Date()); },
      error: (e: { status?: number; error?: { erreur?: string; message?: string } }) => {
        this.loading.set(false);
        if (e?.status === 401) {
          this.sessionExpiree.set(true);
          this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
        } else {
          this.erreur.set(e?.error?.erreur || e?.error?.message || 'L\'historique des machines n\'a pas pu être chargé.');
        }
      },
    });
  }

  selectionnerSession(value: string): void {
    this.contexte.selectionnerParId(value);
  }

  enregistrer(): void {
    const active = this.contexte.sessionActive();
    const id = this.nouvelleMachineId.trim();
    if (!active) { this.afficher('Ouvrez ou sélectionnez une session pour enregistrer une machine.', true); return; }
    if (!id) { this.afficher('Saisissez l’identifiant de la machine.', true); return; }
    this.enregistrement.set(true);
    this.svc.enregistrerMachineDosage(active.id, id).subscribe({
      next: () => {
        this.enregistrement.set(false);
        this.afficher(`Machine ${codeMachine(id)} enregistrée sur la session #${active.id}.`, false);
        this.nouvelleMachineId = '';
        this.charger();
      },
      error: (e: { error?: { erreur?: string; message?: string } }) => {
        this.enregistrement.set(false);
        this.afficher(e?.error?.erreur || e?.error?.message || 'La machine n’a pas pu être enregistrée.', true);
      },
    });
  }

  /** Suggestion : une machine déjà utilisée, saisie en un clic. */
  utiliser(machine: string): void {
    this.nouvelleMachineId = machine;
  }

  basculer(machine: string): void {
    this.ouverte.set(this.ouverte() === machine ? null : machine);
  }

  private afficher(texte: string, erreur: boolean): void {
    this.message.set(texte);
    this.messageErreur.set(erreur);
  }
}
