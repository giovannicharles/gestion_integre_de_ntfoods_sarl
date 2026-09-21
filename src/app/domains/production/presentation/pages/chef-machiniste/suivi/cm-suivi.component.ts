import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionBroyageBE } from '../../../../infrastructure/production.service';

type FiltrePeriode = 'aujourdhui' | 'semaine' | 'mois' | 'personnalise';

/**
 * SUIVI DES RÉALISATIONS — Chef Machiniste
 * Consultation filtrée (aujourd'hui / semaine / mois / période personnalisée) :
 * objectif, réalisé, taux de réalisation, validation de journée.
 */
@Component({
  selector: 'app-cm-suivi',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './cm-suivi.component.html',
  styleUrls: ['./cm-suivi.component.css', '../_shared.css']
})
export class CmSuiviComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  error = signal('');
  sessions = signal<SessionBroyageBE[]>([]);

  filtre = signal<FiltrePeriode>('semaine');
  debutPerso = signal(this.joursAvant(7));
  finPerso = signal(new Date().toISOString().split('T')[0]);

  private joursAvant(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.appliquerFiltre('semaine');
  }

  appliquerFiltre(f: FiltrePeriode): void {
    this.filtre.set(f);
    let debut: string; let fin = new Date().toISOString().split('T')[0];
    if (f === 'aujourdhui') debut = fin;
    else if (f === 'semaine') debut = this.joursAvant(7);
    else if (f === 'mois') debut = this.joursAvant(30);
    else { debut = this.debutPerso(); fin = this.finPerso(); }
    this.charger(debut, fin);
  }

  appliquerPeriodePersonnalisee(): void {
    this.filtre.set('personnalise');
    this.charger(this.debutPerso(), this.finPerso());
  }

  private charger(debut: string, fin: string): void {
    this.loading.set(true);
    this.error.set('');
    this.svc.getSessionsBroyage({ debut, fin }).subscribe({
      next: s => { this.sessions.set(s.sort((a, b) => b.date.localeCompare(a.date))); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors du chargement des réalisations'); this.loading.set(false); }
    });
  }

  tauxRealisation(s: SessionBroyageBE): number {
    return s.objectifJournalierKg > 0 ? Math.round(((s.quantiteNetteBroyeeKg ?? 0) / s.objectifJournalierKg) * 1000) / 10 : 0;
  }
}
