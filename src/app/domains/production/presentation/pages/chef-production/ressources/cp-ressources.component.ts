import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ProductionService, RapportHebdomadaireProductionBE, SessionDosageBE } from '../../../../infrastructure/production.service';
import { DonutChartComponent, DonutSlice } from '../../../shared/charts/donut-chart.component';

/**
 * GESTION DES RESSOURCES — Chef de Production
 *
 * ⚠️ Aucune entité "stock de matières premières" ou "équipement" n'existe
 * côté backend Production (ce serait le rôle d'un module Stock, non fourni).
 * Cette vue montre donc la CONSOMMATION réelle (matières broyées/dosées,
 * machines mobilisées) déduite des rapports et sessions existants — pas de
 * disponibilité ni d'alerte de rupture, qui nécessiteraient un inventaire.
 */
@Component({
  selector: 'app-cp-ressources',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DonutChartComponent],
  templateUrl: './cp-ressources.component.html',
  styleUrls: ['./cp-ressources.component.css', '../_shared.css']
})
export class CpRessourcesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  rapport = signal<RapportHebdomadaireProductionBE | null>(null);
  sessionsDosage = signal<SessionDosageBE[]>([]);

  donutMatieres = computed<DonutSlice[]>(() => {
    const r = this.rapport();
    if (!r) return [];
    const couleurs: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
    return Object.entries(r.quantiteBroyeeParTypePoudre).map(([label, value]) => ({ label, value: Math.round(value * 10) / 10, color: couleurs[label] ?? '#999' }));
  });

  machinesUtilisees = computed(() => {
    const map = new Map<string, number>();
    for (const s of this.sessionsDosage()) for (const m of s.machinesMobilisees) map.set(m, (map.get(m) ?? 0) + 1);
    return Array.from(map.entries()).map(([machine, nbSessions]) => ({ machine, nbSessions })).sort((a, b) => b.nbSessions - a.nbSessions);
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    const fin = new Date().toISOString().split('T')[0];
    const debut = this.joursAvant(7);
    this.svc.getRapportHebdomadaireProduction(debut, fin).subscribe({ next: r => this.rapport.set(r) });
    this.svc.getSessionsDosageParPeriode(debut, fin).subscribe({ next: s => { this.sessionsDosage.set(s); this.loading.set(false); } });
  }

  private joursAvant(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

  objectKeys(o: Record<string, number> | undefined | null): string[] { return o ? Object.keys(o) : []; }
}
