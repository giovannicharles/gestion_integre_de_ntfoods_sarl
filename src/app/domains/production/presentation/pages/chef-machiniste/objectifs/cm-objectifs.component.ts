import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  ProductionService, PPHBE, EmployeBE, SessionBroyageBE,
  OPERATIONS_BROYAGE, TYPES_POUDRE
} from '../../../../infrastructure/production.service';

interface ObjectifDraft {
  machinisteMatricule: string; nomMachiniste: string; operation: string; objectifKg: number;
}

/**
 * DÉFINITION DES OBJECTIFS DES MACHINISTES — Chef Machiniste
 *
 * ⚠️ Limite backend : le backend n'expose la création d'objectifs QUE groupée
 * dans l'ouverture d'une session de broyage (POST /broyage/sessions avec
 * objectifsMachinistes[]). Il n'existe pas de PATCH/DELETE pour modifier ou
 * supprimer un objectif isolé après coup.
 *
 * Chargement : forkJoin pour un état de chargement unique, MAIS chaque flux est
 * isolé par catchError — un échec sur les PPH ou les sessions ne doit jamais
 * faire disparaître la liste des machinistes (et inversement).
 */
@Component({
  selector: 'app-cm-objectifs',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './cm-objectifs.component.html',
  styleUrls: ['./cm-objectifs.component.css', '../_shared.css']
})
export class CmObjectifsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  message = signal('');
  pphs = signal<PPHBE[]>([]);
  machinistes = signal<EmployeBE[]>([]);
  sessions = signal<SessionBroyageBE[]>([]);

  // Référentiels réels (miroir des enums backend) — { code, libelle }[]
  readonly operations = OPERATIONS_BROYAGE;
  readonly typesPoudre = TYPES_POUDRE;

  // Formulaire de création (nouvelle session = nouveaux objectifs groupés)
  nouvelleSession = {
    referencePPH: '', date: new Date().toISOString().split('T')[0], typePoudre: 'MAIS', objectifJournalierKg: 0,
  };
  brouillonObjectifs = signal<ObjectifDraft[]>([]);
  nouvelObjectif: ObjectifDraft = { machinisteMatricule: '', nomMachiniste: '', operation: 'ECRASAGE', objectifKg: 0 };

  totalObjectifsBrouillon = computed(() => this.brouillonObjectifs().reduce((s, o) => s + o.objectifKg, 0));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.message.set('');
    const echecs: string[] = [];

    forkJoin({
      pphs: this.svc.getPPHs().pipe(
        catchError(() => { echecs.push('PPH'); return of([] as PPHBE[]); })
      ),
      machinistes: this.svc.getMachinistes().pipe(
        tap(data => console.log('Machinistes :', data)),
          catchError(err => {
            echecs.push('machinistes');
            console.error('Erreur lors du chargement des machinistes :', err);
            return of([] as EmployeBE[]);
          })
        ),
      sessions: this.svc.getSessionsBroyage({
        debut: this.septJoursAvant(),
        fin: new Date().toISOString().split('T')[0],
      }).pipe(
        catchError(() => { echecs.push('sessions de broyage'); return of([] as SessionBroyageBE[]); })
      ),
    }).subscribe(({ pphs, machinistes, sessions }) => {
      this.pphs.set(pphs);
      this.machinistes.set(machinistes);
      this.sessions.set(sessions);
      this.loading.set(false);
      if (echecs.length) {
        this.message.set(`Chargement partiel — échec sur : ${echecs.join(', ')}.`);
      }
    });
  }

  private septJoursAvant(): string {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }

  /** Libellé lisible d'une opération de broyage à partir de son code. */
  libelleOperation(code: string): string {
    return this.operations.find(o => o.code === code)?.libelle ?? code;
  }

  selectionnerMachiniste(matricule: string): void {
    const m = this.machinistes().find(x => x.matricule === matricule);
    this.nouvelObjectif.machinisteMatricule = matricule;
    this.nouvelObjectif.nomMachiniste = m?.nomComplet ?? matricule;
  }

  ajouterAuBrouillon(): void {
    if (!this.nouvelObjectif.machinisteMatricule || this.nouvelObjectif.objectifKg <= 0) {
      this.message.set('Sélectionnez un machiniste et un objectif > 0');
      return;
    }
    this.brouillonObjectifs.update(list => [...list, { ...this.nouvelObjectif }]);
    this.nouvelObjectif = { machinisteMatricule: '', nomMachiniste: '', operation: 'ECRASAGE', objectifKg: 0 };
  }

  retirerDuBrouillon(index: number): void {
    this.brouillonObjectifs.update(list => list.filter((_, i) => i !== index));
  }

  creerObjectifs(): void {
    if (!this.nouvelleSession.referencePPH || this.brouillonObjectifs().length === 0) {
      this.message.set('PPH et au moins un objectif sont requis');
      return;
    }
    this.svc.ouvrirSessionBroyage({
      ...this.nouvelleSession,
      objectifsMachinistes: this.brouillonObjectifs(),
    }).subscribe({
      next: s => {
        this.sessions.update(list => [s, ...list]);
        this.brouillonObjectifs.set([]);
        this.message.set(`Objectifs créés — session #${s.id} ouverte pour ${s.date}`);
      },
      error: () => this.message.set('Erreur lors de la création des objectifs')
    });
  }
}