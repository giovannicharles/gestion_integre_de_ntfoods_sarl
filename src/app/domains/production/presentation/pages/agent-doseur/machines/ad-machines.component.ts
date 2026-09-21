import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionDosageBE } from '../../../../infrastructure/production.service';
import { AdSessionContextService } from '../ad-session-context.service';

/**
 * GESTION DES MACHINES — Agent Doseur
 *
 * ⚠️ Le backend enregistre uniquement l'identifiant de chaque machine mobilisée
 * sur une session (liste plate), sans horodatage ni durée. La sélection de
 * session est déléguée à AdSessionContextService.
 */
@Component({
  selector: 'app-ad-machines',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './ad-machines.component.html',
  styleUrls: ['./ad-machines.component.css', '../_shared.css'],
})
export class AdMachinesComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  readonly contexte = inject(AdSessionContextService);

  message = signal('');
  erreurAcces = signal(false);
  loading = signal(true);
  historique = signal<SessionDosageBE[]>([]);

  nouvelleMachineId = '';
  today = this.contexte.today;

  /** Historique d'utilisation dérivé : pour chaque machine, sessions où elle a été mobilisée. */
  utilisationParMachine = computed(() => {
    const map = new Map<string, { session: SessionDosageBE }[]>();
    for (const s of this.historique()) {
      for (const m of s.machinesMobilisees) {
        if (!map.has(m)) map.set(m, []);
        map.get(m)!.push({ session: s });
      }
    }
    return Array.from(map.entries()).map(([machine, sessions]) => ({ machine, sessions }));
  });

  ngOnInit(): void {
    this.contexte.chargerSessionsOuvertes();
    this.chargerHistorique();
  }

  chargerHistorique(): void {
    this.loading.set(true);
    this.erreurAcces.set(false);
    this.svc.getSessionsDosageParPeriode(this.joursAvant(14), this.today).subscribe({
      next: s => { this.historique.set(s); this.loading.set(false); },
      error: () => { this.erreurAcces.set(true); this.loading.set(false); },
    });
  }

  private joursAvant(n: number): string {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0];
  }

  selectionnerSessionDepuisSelect(value: string): void {
    this.contexte.selectionnerParId(value);
  }

  enregistrerMachine(): void {
    const active = this.contexte.sessionActive();
    if (!active || !this.nouvelleMachineId.trim()) {
      this.message.set('Session ouverte et identifiant de machine sont obligatoires');
      return;
    }
    this.svc.enregistrerMachineDosage(active.id, this.nouvelleMachineId.trim()).subscribe({
      next: () => {
        this.message.set(`Machine ${this.nouvelleMachineId} enregistrée sur la session #${active.id}`);
        this.nouvelleMachineId = '';
        this.chargerHistorique();
      },
      error: () => this.message.set("Erreur lors de l'enregistrement de la machine"),
    });
  }
}
