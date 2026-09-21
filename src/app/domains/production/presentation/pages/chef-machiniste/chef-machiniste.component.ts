import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ProductionService, SessionBroyageBE,
  EmployeBE, ClassementMachinisteBE
} from '../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/charts/donut-chart.component';

@Component({
  selector: 'app-chef-machiniste',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink, MiniChartComponent, DonutChartComponent],
  templateUrl: './chef-machiniste.component.html',
  styleUrls: ['./chef-machiniste.component.css']
})
export class ChefMachinisteComponent implements OnInit {
  private readonly prodSvc = inject(ProductionService);

  today = new Date().toISOString().split('T')[0];
  semaineDebut = signal(this.debutSemaine(new Date()));
  semaineFin = signal(this.today);
  moisDebut = signal(this.debutMois(new Date()));
  moisFin = signal(this.today);

  machinistes = signal<EmployeBE[]>([]);
  sessions = signal<SessionBroyageBE[]>([]);
  classementHebdo = signal<ClassementMachinisteBE | null>(null);
  classementMensuel = signal<ClassementMachinisteBE | null>(null);
  loading = signal(true);

  showFormSession = signal(false);
  showFormRealisation = signal(false);
  selectedSession = signal<SessionBroyageBE | null>(null);
  detailSession = signal<SessionBroyageBE | null>(null);

  nouvelleSession = {
    referencePPH: '', date: this.today, typePoudre: 'MAIS',
    objectifJournalierKg: 0,
    objectifsMachinistes: [] as { machinisteMatricule: string; nomMachiniste: string; operation: string; objectifKg: number }[]
  };

  nouvelleRealisation = {
    sessionId: 0, machinisteMatricule: '', nomMachiniste: '',
    operation: 'ECRASAGE', typePoudre: 'MAIS', objectifKg: 0, realiseKg: 0
  };

  operations = ['ECRASAGE', 'TRIAGE', 'TAMISAGE', 'DEPULPAGE'];
  typesPoudre = ['MAIS', 'SOJA', 'ARACHIDE'];

  // Performance individuelle d'un machiniste sur une période
  performanceMatricule = '';
  performanceSessions = signal<SessionBroyageBE[]>([]);

  /** Historique des 7 derniers jours (vrai appel GET /broyage/sessions sur la période) pour l'évolution. */
  historique7Jours = signal<SessionBroyageBE[]>([]);

  labelsHistorique = computed(() => {
    const jours: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      jours.push(d.toISOString().split('T')[0]);
    }
    return jours.map(j => j.slice(5).split('-').reverse().join('/'));
  });

  private joursDesSeptDerniers(): string[] {
    const jours: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      jours.push(d.toISOString().split('T')[0]);
    }
    return jours;
  }

  /** Évolution de la poudre nette broyée sur 7 jours, agrégée par jour à partir des vraies sessions. */
  serieEvolutionPoudre = computed<ChartSeries[]>(() => {
    const jours = this.joursDesSeptDerniers();
    const sessions = this.historique7Jours();
    return [{
      name: 'Poudre broyée (kg)', color: 'var(--primary, #1976d2)',
      values: jours.map(j => sessions.filter(s => s.date === j).reduce((sum, s) => sum + (s.quantiteNetteBroyeeKg ?? 0), 0)),
    }];
  });

  /** Évolution des pertes (kg) sur 7 jours. */
  serieEvolutionPertes = computed<ChartSeries[]>(() => {
    const jours = this.joursDesSeptDerniers();
    const sessions = this.historique7Jours();
    return [{
      name: 'Pertes (kg)', color: 'var(--danger, #d32f2f)',
      values: jours.map(j => sessions.filter(s => s.date === j).reduce((sum, s) => sum + (s.pertesKg ?? 0), 0)),
    }];
  });

  /** Répartition de la poudre broyée par type sur les 7 derniers jours. */
  donutTypePoudre = computed<DonutSlice[]>(() => {
    const couleurs: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
    const sessions = this.historique7Jours();
    const parType = new Map<string, number>();
    for (const s of sessions) {
      parType.set(s.typePoudreLibelle, (parType.get(s.typePoudreLibelle) ?? 0) + (s.quantiteNetteBroyeeKg ?? 0));
    }
    return Array.from(parType.entries()).map(([label, value], i) => ({
      label, value: Math.round(value * 10) / 10, color: Object.values(couleurs)[i % 3]
    }));
  });

  /** Classement machinistes hebdomadaire sous forme de graphique en barres (productivité kg). */
  serieClassementHebdo = computed<ChartSeries[]>(() => {
    const c = this.classementHebdo()?.classements ?? [];
    return [{ name: 'Productivité (kg)', color: 'var(--success, #2e7d32)', values: c.map(x => x.productiviteKg) }];
  });
  labelsClassementHebdo = computed(() => (this.classementHebdo()?.classements ?? []).map(c => c.nomMachiniste));

  totalPoudreJour = computed(() =>
    this.sessions()
      .filter(s => s.date === this.today)
      .reduce((s, sess) => s + (sess.quantiteNetteBroyeeKg ?? 0), 0)
  );

  totalPertesJour = computed(() =>
    this.sessions()
      .filter(s => s.date === this.today)
      .reduce((s, sess) => s + (sess.pertesKg ?? 0), 0)
  );

  sessionsNonValidees = computed(() =>
    this.sessions().filter(s => !s.journeeValidee && s.statut !== 'CLOTUREE')
  );

  ngOnInit(): void {
    this.chargerDonnees();
  }

  chargerDonnees(): void {
    this.loading.set(true);
    this.prodSvc.getMachinistes().subscribe({
      next: m => this.machinistes.set(m),
      error: () => this.loading.set(false)
    });
    this.prodSvc.getSessionsBroyage({ debut: this.today, fin: this.today }).subscribe({
      next: s => { this.sessions.set(s); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.prodSvc.getClassementMachinistes(this.semaineDebut(), this.semaineFin()).subscribe({
      next: c => this.classementHebdo.set(c)
    });
    this.prodSvc.getClassementMachinistes(this.moisDebut(), this.moisFin()).subscribe({
      next: c => this.classementMensuel.set(c)
    });
    const debut7j = this.joursDesSeptDerniers()[0];
    this.prodSvc.getSessionsBroyage({ debut: debut7j, fin: this.today }).subscribe({
      next: s => this.historique7Jours.set(s),
      error: () => this.historique7Jours.set([])
    });
  }

  ouvrirSession(): void {
    this.prodSvc.ouvrirSessionBroyage(this.nouvelleSession).subscribe({
      next: s => { this.sessions.update(list => [s, ...list]); this.showFormSession.set(false); }
    });
  }

  ajouterObjectif(): void {
    this.nouvelleSession.objectifsMachinistes.push({
      machinisteMatricule: '', nomMachiniste: '', operation: 'ECRASAGE', objectifKg: 0
    });
  }

  retirerObjectif(index: number): void {
    this.nouvelleSession.objectifsMachinistes.splice(index, 1);
  }

  selectionnerMachiniste(index: number, matricule: string): void {
    const m = this.machinistes().find(x => x.matricule === matricule);
    if (m) {
      this.nouvelleSession.objectifsMachinistes[index].nomMachiniste = m.nomComplet;
    }
  }

  ouvrirRealisation(session: SessionBroyageBE): void {
    this.selectedSession.set(session);
    this.nouvelleRealisation = {
      sessionId: session.id,
      machinisteMatricule: '',
      nomMachiniste: '',
      operation: 'ECRASAGE',
      typePoudre: session.typePoudre,
      objectifKg: 0,
      realiseKg: 0
    };
    this.showFormRealisation.set(true);
  }

  selectionnerMachinisteRealisation(matricule: string): void {
    const m = this.machinistes().find(x => x.matricule === matricule);
    if (m) {
      this.nouvelleRealisation.nomMachiniste = m.nomComplet;
    }
  }

  enregistrerRealisation(): void {
    this.prodSvc.enregistrerRealisationBroyage(this.nouvelleRealisation).subscribe({
      next: s => {
        this.sessions.update(list => list.map(x => x.id === s.id ? s : x));
        this.showFormRealisation.set(false);
        this.selectedSession.set(null);
      }
    });
  }

  cloturerSession(session: SessionBroyageBE): void {
    const quantite = prompt('Quantité nette broyée (kg) ?');
    const pertes = prompt('Pertes (kg) ?');
    if (quantite && pertes) {
      this.prodSvc.cloturerSessionBroyage({
        sessionId: session.id,
        quantiteNetteBroyeeKg: Number(quantite),
        pertesKg: Number(pertes)
      }).subscribe({
        next: s => this.sessions.update(list => list.map(x => x.id === s.id ? s : x))
      });
    }
  }

  autoriserDepassement(session: SessionBroyageBE): void {
    const qte = prompt('Quantité supplémentaire à autoriser (kg) ?');
    if (qte) {
      this.prodSvc.autoriserDepassementBroyage(session.id, Number(qte)).subscribe({
        next: s => this.sessions.update(list => list.map(x => x.id === s.id ? s : x))
      });
    }
  }

  justifierSession(session: SessionBroyageBE): void {
    const motif = prompt('Justificatif de non-validation (moins de 85 %) :');
    if (motif) {
      this.prodSvc.justifierNonValidationBroyage(session.id, motif).subscribe({
        next: s => this.sessions.update(list => list.map(x => x.id === s.id ? s : x))
      });
    }
  }

  reloadClassements(): void {
    this.prodSvc.getClassementMachinistes(this.semaineDebut(), this.semaineFin()).subscribe({
      next: c => this.classementHebdo.set(c)
    });
    this.prodSvc.getClassementMachinistes(this.moisDebut(), this.moisFin()).subscribe({
      next: c => this.classementMensuel.set(c)
    });
  }

  rechercherPerformance(): void {
    if (!this.performanceMatricule) return;
    this.prodSvc.getPerformancesMachiniste(this.performanceMatricule, this.moisDebut(), this.moisFin()).subscribe({
      next: s => this.performanceSessions.set(s)
    });
  }

  /** Consultation détaillée d'une session (rafraîchie depuis le serveur). */
  voirDetailSession(id: number): void {
    this.prodSvc.getSessionBroyage(id).subscribe({
      next: s => this.detailSession.set(s),
      error: () => this.detailSession.set(null)
    });
  }

  private debutSemaine(d: Date): string {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const lundi = new Date(d.setDate(diff));
    return lundi.toISOString().split('T')[0];
  }

  private debutMois(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }
}
