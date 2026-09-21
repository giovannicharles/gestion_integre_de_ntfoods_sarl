import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionDosageBE, PPHBE } from '../../../../infrastructure/production.service';
import { AdSessionContextService } from '../ad-session-context.service';
import { AuthService } from '../../../../../../core/auth/auth.service';

/**
 * GESTION DES SESSIONS — Agent Doseur
 * Ouvrir / consulter / clôturer une session de dosage. Une seule session
 * active à la fois (garde-fou client ; l'application stricte de la règle
 * reste de la responsabilité du backend).
 *
 * L'historique (sessions passées) dépend de GET /dosage/date/{date} et
 * /dosage/periode, autorisés pour AGENT_DOSEUR.
 */
@Component({
  selector: 'app-ad-sessions',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './ad-sessions.component.html',
  styleUrls: ['./ad-sessions.component.css', '../_shared.css']
})
export class AdSessionsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly auth = inject(AuthService);
  readonly contexte = inject(AdSessionContextService);

  loading = signal(true);
  message = signal('');
  erreurHistorique = signal(false);

  pphs = signal<PPHBE[]>([]);
  sessionsSession = signal<SessionDosageBE[]>([]); // sessions ouvertes/manipulées pendant cette visite navigateur
  historique = signal<SessionDosageBE[]>([]);

  nouvelleSession = { referencePPH: '', date: new Date().toISOString().split('T')[0], matriculeAgentDoseur: '' };

  sessionOuverteActive = computed(() => this.sessionsSession().find(s => !s.cloturee) ?? null);

  ngOnInit(): void {
    const user = this.auth.user();
    if (user) this.nouvelleSession.matriculeAgentDoseur = user.matricule;
    this.svc.getPPHs().subscribe({ next: p => this.pphs.set(p) });
    this.chargerHistorique();
  }

  chargerHistorique(): void {
    this.loading.set(true);
    this.erreurHistorique.set(false);
    const debut7j = this.joursAvant(7);
    this.svc.getSessionsDosageParPeriode(debut7j, new Date().toISOString().split('T')[0]).subscribe({
      next: s => { this.historique.set(s); this.loading.set(false); },
      error: () => { this.erreurHistorique.set(true); this.loading.set(false); }
    });
  }

  private joursAvant(n: number): string {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0];
  }

  ouvrir(): void {
    if (this.sessionOuverteActive()) {
      this.message.set('Une session est déjà ouverte — une seule session active est autorisée à la fois.');
      return;
    }
    if (!this.nouvelleSession.referencePPH || !this.nouvelleSession.matriculeAgentDoseur) {
      this.message.set('PPH et matricule agent doseur sont obligatoires');
      return;
    }
    this.svc.ouvrirSessionDosage(this.nouvelleSession).subscribe({
      next: s => {
        this.sessionsSession.update(list => [s, ...list]);
        this.contexte.definir(s.id, s.referencePPH, s.date);
        this.message.set(`Session #${s.id} ouverte — sélectionnée comme session active pour les autres vues`);
      },
      error: () => this.message.set('Erreur lors de l\'ouverture de la session')
    });
  }

  cloturer(s: SessionDosageBE): void {
    if (!confirm(`Clôturer la session #${s.id} ?`)) return;
    this.svc.cloturerSessionDosage(s.id).subscribe({
      next: updated => {
        this.sessionsSession.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.message.set(`Session #${updated.id} clôturée`);
      },
      error: () => this.message.set('Erreur lors de la clôture')
    });
  }

  selectionner(s: SessionDosageBE): void {
    if (s.cloturee || s.validee) {
      this.message.set(`La session #${s.id} n'est pas ouverte — impossible de la sélectionner`);
      return;
    }
    this.contexte.definir(s.id, s.referencePPH, s.date);
    this.message.set(`Session #${s.id} sélectionnée comme active`);
  }

  duree(s: SessionDosageBE): string {
    if (!s.cloturee) return '—';
    const debut = new Date(s.dateCreation).getTime();
    const fin = new Date(s.dateModification).getTime();
    const minutes = Math.round((fin - debut) / 60000);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h${(minutes % 60).toString().padStart(2, '0')}`;
  }
}
