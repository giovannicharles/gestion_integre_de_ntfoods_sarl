import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ProductionService, OFBE, PPHBE } from '../../../../infrastructure/production.service';

/**
 * SUIVI GLOBAL DE LA PRODUCTION — Chef de Production
 * Production en cours / terminée / restante, taux d'avancement, objectifs
 * atteints, retards et dépassements — à partir des OF et PPH réels.
 */
@Component({
  selector: 'app-cp-suivi-global',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe],
  templateUrl: './cp-suivi-global.component.html',
  styleUrls: ['./cp-suivi-global.component.css', '../_shared.css']
})
export class CpSuiviGlobalComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  ofs = signal<OFBE[]>([]);
  pphs = signal<PPHBE[]>([]);

  ofEnCours = computed(() => this.ofs().filter(o => o.statut === 'EN_COURS'));
  ofTermines = computed(() => this.ofs().filter(o => o.statut === 'HONORE'));
  ofPlanifies = computed(() => this.ofs().filter(o => o.statut === 'PLANIFIE'));

  productionRestante = computed(() => this.ofs().reduce((s, o) => s + Math.max(0, o.qteDemandee - o.qteRealisee), 0));
  productionTotale = computed(() => this.ofs().reduce((s, o) => s + o.qteRealisee, 0));
  tauxAvancementGlobal = computed(() => {
    const dem = this.ofs().reduce((s, o) => s + o.qteDemandee, 0);
    return dem > 0 ? Math.round((this.productionTotale() / dem) * 1000) / 10 : 0;
  });

  /** Retards : OF dont la date butoir est dépassée et non honoré. */
  ofEnRetard = computed(() => {
    const aujourdHui = new Date().toISOString().split('T')[0];
    return this.ofs().filter(o => o.statut !== 'HONORE' && o.statut !== 'ANNULE' && o.dateButoir && o.dateButoir < aujourdHui);
  });

  /** Dépassements : OF où le réalisé dépasse la demande. */
  ofEnDepassement = computed(() => this.ofs().filter(o => o.qteRealisee > o.qteDemandee));

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getOFs().subscribe({ next: o => this.ofs.set(o) });
    this.svc.getPPHs().subscribe({ next: p => { this.pphs.set(p); this.loading.set(false); } });
  }

  progression(o: OFBE): number {
    return o.qteDemandee > 0 ? Math.min(100, Math.round((o.qteRealisee / o.qteDemandee) * 100)) : 0;
  }
}
