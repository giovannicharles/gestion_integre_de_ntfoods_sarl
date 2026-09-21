import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionBroyageBE } from '../../../../infrastructure/production.service';

/**
 * SAISIE DES INDICATEURS JOURNALIERS — Chef Machiniste
 * Quantité nette broyée + pertes (kg) → % de pertes recalculé automatiquement.
 * Répartition Maïs / Soja / Arachide affichée automatiquement à partir des
 * sessions du jour (déjà scindées par type de poudre côté backend).
 */
@Component({
  selector: 'app-cm-indicateurs',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './cm-indicateurs.component.html',
  styleUrls: ['./cm-indicateurs.component.css', '../_shared.css']
})
export class CmIndicateursComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  today = new Date().toISOString().split('T')[0];
  loading = signal(true);
  message = signal('');
  sessionsJour = signal<SessionBroyageBE[]>([]);

  cloture = {
    sessionId: 0, quantiteNetteBroyeeKg: 0, pertesKg: 0,
  };

  /** % de pertes recalculé automatiquement = pertes / (nette + pertes) × 100. */
  pctPertesCalcule(): number {
    const total = this.cloture.quantiteNetteBroyeeKg + this.cloture.pertesKg;
    return total > 0 ? Math.round((this.cloture.pertesKg / total) * 1000) / 10 : 0;
  }

  /** Quantité nette broyée = somme des réalisations du poste ECRASAGE de la session. */
  private calculerQuantiteNette(session: SessionBroyageBE): number {
    return session.realisations
      .filter(r => r.operation === 'ECRASAGE')
      .reduce((sum, r) => sum + (r.realiseKg ?? 0), 0);
  }

  maisJour = computed(() => this.parType('MAIS'));
  sojaJour = computed(() => this.parType('SOJA'));
  arachideJour = computed(() => this.parType('ARACHIDE'));
  private parType(type: string): number {
    return this.sessionsJour().filter(s => s.typePoudre === type).reduce((sum, s) => {
      // Si la session n'est pas encore clôturée, on calcule l'indicateur automatiquement
      // à partir des réalisations du poste ECRASAGE.
      const nette = s.quantiteNetteBroyeeKg ?? this.calculerQuantiteNette(s);
      return sum + nette;
    }, 0);
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getSessionsBroyage({ debut: this.today, fin: this.today }).subscribe({
      next: s => { this.sessionsJour.set(s); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  selectionnerSession(sessionId: number): void {
    const session = this.sessionsJour().find(s => s.id === +sessionId);
    if (!session) {
      this.cloture = { sessionId: 0, quantiteNetteBroyeeKg: 0, pertesKg: 0 };
      return;
    }
    this.cloture.sessionId = session.id;
    // Pré-remplissage automatique : quantité nette depuis le poste ECRASAGE,
    // pertes depuis la session si déjà saisie, sinon 0.
    this.cloture.quantiteNetteBroyeeKg = session.quantiteNetteBroyeeKg ?? this.calculerQuantiteNette(session);
    this.cloture.pertesKg = session.pertesKg ?? 0;
  }

  cloturerSession(): void {
    if (!this.cloture.sessionId || this.cloture.quantiteNetteBroyeeKg <= 0) {
      this.message.set('Session et quantité nette broyée sont obligatoires. La saisie des pertes est requise même si elle est à 0.');
      return;
    }
    this.svc.cloturerSessionBroyage(this.cloture).subscribe({
      next: s => {
        this.sessionsJour.update(list => list.map(x => x.id === s.id ? s : x));
        this.message.set(`Indicateurs enregistrés — session #${s.id} clôturée (${s.pctPertes ?? 0}% de pertes)`);
        this.cloture = { sessionId: 0, quantiteNetteBroyeeKg: 0, pertesKg: 0 };
      },
      error: () => this.message.set('Erreur lors de la clôture de la session')
    });
  }
}
