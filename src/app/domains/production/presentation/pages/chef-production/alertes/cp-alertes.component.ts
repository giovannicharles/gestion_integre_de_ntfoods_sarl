import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ProductionService, OFBE, SessionBroyageBE, SessionDosageBE } from '../../../../infrastructure/production.service';

interface AlerteUI {
  type: 'retard' | 'depassement' | 'pertes' | 'objectif' | 'ecart';
  gravite: 'danger' | 'warning';
  titre: string;
  detail: string;
  date: string;
}

/**
 * GESTION DES ALERTES — Chef de Production
 *
 * ⚠️ Aucun moteur d'alertes persistées côté backend : pas d'entité "Alerte",
 * pas d'endpoint pour la "traiter" ou la "clôturer". Cette vue calcule des
 * alertes en LECTURE SEULE à partir de seuils appliqués à des données réelles
 * (OF, sessions broyage, sessions dosage) — rien n'est stocké, rien ne peut
 * être marqué "traité" de façon persistante.
 */
@Component({
  selector: 'app-cp-alertes',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './cp-alertes.component.html',
  styleUrls: ['./cp-alertes.component.css', '../_shared.css']
})
export class CpAlertesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  ofs = signal<OFBE[]>([]);
  sessionsBroyage = signal<SessionBroyageBE[]>([]);
  sessionsDosage = signal<SessionDosageBE[]>([]);
  filtreType = signal<string>('');

  alertes = computed<AlerteUI[]>(() => {
    const liste: AlerteUI[] = [];
    const aujourdHui = new Date().toISOString().split('T')[0];

    for (const o of this.ofs()) {
      if (o.statut !== 'HONORE' && o.statut !== 'ANNULE' && o.dateButoir && o.dateButoir < aujourdHui) {
        liste.push({ type: 'retard', gravite: 'danger', titre: `Retard — OF ${o.idOF}`, detail: `Échéance dépassée (${o.dateButoir}), ${o.qteRealisee}/${o.qteDemandee} réalisé`, date: o.dateButoir });
      }
      if (o.qteRealisee > o.qteDemandee) {
        liste.push({ type: 'depassement', gravite: 'warning', titre: `Dépassement — OF ${o.idOF}`, detail: `${o.qteRealisee} produit pour ${o.qteDemandee} demandé`, date: aujourdHui });
      }
    }
    for (const s of this.sessionsBroyage()) {
      if ((s.pctPertes ?? 0) > 15) {
        liste.push({ type: 'pertes', gravite: 'danger', titre: `Pertes importantes — session broyage #${s.id}`, detail: `${s.pctPertes}% de pertes (${s.referencePPH}, ${s.typePoudreLibelle})`, date: s.date });
      }
      if (!s.journeeValidee && s.statut === 'CLOTUREE') {
        liste.push({ type: 'objectif', gravite: 'warning', titre: `Objectif non atteint — session #${s.id}`, detail: `${s.referencePPH} — ${s.totalRealiseKg}/${s.objectifJournalierKg} kg`, date: s.date });
      }
    }
    for (const s of this.sessionsDosage()) {
      if (s.justificationEcart) {
        liste.push({ type: 'ecart', gravite: 'warning', titre: `Écart justifié — session dosage #${s.id}`, detail: s.justificationEcart, date: s.date });
      }
    }
    return liste.sort((a, b) => b.date.localeCompare(a.date));
  });

  alertesFiltrees = computed(() => {
    const f = this.filtreType();
    return f ? this.alertes().filter(a => a.type === f) : this.alertes();
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    const fin = new Date().toISOString().split('T')[0];
    const debut = this.joursAvant(14);
    this.svc.getOFs().subscribe({ next: o => this.ofs.set(o) });
    this.svc.getSessionsBroyage({ debut, fin }).subscribe({ next: s => this.sessionsBroyage.set(s) });
    this.svc.getSessionsDosageParPeriode(debut, fin).subscribe({ next: s => { this.sessionsDosage.set(s); this.loading.set(false); } });
  }

  private joursAvant(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }
}
