import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionBroyageBE, EmployeBE } from '../../../../infrastructure/production.service';

/**
 * GESTION DES RÉALISATIONS JOURNALIÈRES — Chef Machiniste
 * Saisie : machiniste, poste, type de poudre, quantité réalisée, date.
 * Affiche automatiquement objectif / réalisé / différence / % de réalisation.
 */
@Component({
  selector: 'app-cm-realisations',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './cm-realisations.component.html',
  styleUrls: ['./cm-realisations.component.css', '../_shared.css']
})
export class CmRealisationsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  today = new Date().toISOString().split('T')[0];
  loading = signal(true);
  message = signal('');

  machinistes = signal<EmployeBE[]>([]);
  sessionsJour = signal<SessionBroyageBE[]>([]);
  operations = ['ECRASAGE', 'TRIAGE', 'TAMISAGE', 'DEPULPAGE'];

  saisie = {
    sessionId: 0, machinisteMatricule: '', nomMachiniste: '',
    operation: 'ECRASAGE', typePoudre: 'MAIS', objectifKg: 0, realiseKg: 0,
  };

  /** Différence auto-calculée (réalisé - objectif). */
  difference(): number {
    return this.saisie.realiseKg - this.saisie.objectifKg;
  }
  /** % de réalisation auto-calculé = réalisé / objectif × 100. */
  pctRealisation(): number {
    return this.saisie.objectifKg > 0 ? Math.round((this.saisie.realiseKg / this.saisie.objectifKg) * 1000) / 10 : 0;
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getMachinistes().subscribe({ next: m => this.machinistes.set(m) });
    this.svc.getSessionsBroyage({ debut: this.today, fin: this.today }).subscribe({
      next: s => { this.sessionsJour.set(s); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  selectionnerSession(sessionId: number): void {
    const s = this.sessionsJour().find(x => x.id === +sessionId);
    if (s) {
      this.saisie.sessionId = s.id;
      this.saisie.typePoudre = s.typePoudre;
    }
  }

  selectionnerMachiniste(matricule: string): void {
    const m = this.machinistes().find(x => x.matricule === matricule);
    this.saisie.machinisteMatricule = matricule;
    this.saisie.nomMachiniste = m?.nomComplet ?? matricule;

    // Récupère la session courante, ou la première session qui contient un objectif pour ce machiniste.
    let session = this.sessionsJour().find(s => s.id === this.saisie.sessionId);
    if (!session) {
      session = this.sessionsJour().find(s => s.objectifsMachinistes.some(o => o.machinisteMatricule === matricule));
      if (session) this.saisie.sessionId = session.id;
    }

    if (!session) {
      this.saisie.operation = 'ECRASAGE';
      this.saisie.objectifKg = 0;
      this.saisie.typePoudre = 'MAIS';
      return;
    }

    this.saisie.typePoudre = session.typePoudre;

    const objectifs = session.objectifsMachinistes.filter(o => o.machinisteMatricule === matricule);
    if (objectifs.length === 0) {
      this.saisie.objectifKg = 0;
      return;
    }

    // Si un seul objectif : poste et quantité auto-renseignés.
    // Si plusieurs : on garde le poste courant s'il existe parmi ceux de l'objectif, sinon on prend le premier.
    const matching = objectifs.find(o => o.operation === this.saisie.operation) ?? objectifs[0];
    this.saisie.operation = matching.operation;
    this.saisie.objectifKg = matching.objectifKg;
  }

  enregistrer(): void {
    if (!this.saisie.sessionId || !this.saisie.machinisteMatricule || this.saisie.realiseKg <= 0) {
      this.message.set('Session, machiniste et quantité réalisée sont obligatoires');
      return;
    }
    this.svc.enregistrerRealisationBroyage(this.saisie).subscribe({
      next: s => {
        this.sessionsJour.update(list => list.map(x => x.id === s.id ? s : x));
        this.message.set(`Réalisation enregistrée pour ${this.saisie.nomMachiniste}`);
        this.saisie = { sessionId: this.saisie.sessionId, machinisteMatricule: '', nomMachiniste: '', operation: 'ECRASAGE', typePoudre: this.saisie.typePoudre, objectifKg: 0, realiseKg: 0 };
      },
      error: () => this.message.set('Erreur lors de l\'enregistrement de la réalisation')
    });
  }
}
