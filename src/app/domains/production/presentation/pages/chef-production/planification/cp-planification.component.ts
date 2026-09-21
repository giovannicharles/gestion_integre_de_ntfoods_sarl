import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE } from '../../../../infrastructure/production.service';

/**
 * PLANIFICATION DE LA PRODUCTION — Chef de Production
 * Répartition journalière (calendrier de la semaine du PPH), ajustement des
 * objectifs par produit (PUT /pph/{ref}/lignes, endpoint réel), consultation
 * des ressources (matières/fûts) planifiées par jour.
 */
@Component({
  selector: 'app-cp-planification',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './cp-planification.component.html',
  styleUrls: ['./cp-planification.component.css', '../_shared.css']
})
export class CpPlanificationComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  message = signal('');
  pphs = signal<PPHBE[]>([]);
  pphSelectionne = signal<PPHBE | null>(null);

  lignesEdition: { codeProduit: string; objectifSemaine: number }[] = [];

  avancementGlobal = computed(() => {
    const p = this.pphSelectionne();
    if (!p || !p.lignes.length) return 0;
    const obj = p.lignes.reduce((s, l) => s + l.objectifSemaine, 0);
    const rea = p.lignes.reduce((s, l) => s + l.productionRealisee, 0);
    return obj > 0 ? Math.round((rea / obj) * 1000) / 10 : 0;
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs('EN_COURS').subscribe({
      next: list => {
        this.pphs.set(list);
        if (list.length) this.selectionner(list[0]);
        this.loading.set(false);
      },
      error: () => { this.message.set('Erreur lors du chargement des PPH'); this.loading.set(false); }
    });
  }

  selectionner(p: PPHBE): void {
    this.pphSelectionne.set(p);
    this.lignesEdition = p.lignes.map(l => ({ codeProduit: l.codeProduit, objectifSemaine: l.objectifSemaine }));
  }

  enregistrerAjustements(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.svc.modifierLignesPPH(p.referencePPH, this.lignesEdition).subscribe({
      next: updated => {
        this.pphs.update(list => list.map(x => x.referencePPH === updated.referencePPH ? updated : x));
        this.pphSelectionne.set(updated);
        this.message.set('Objectifs ajustés avec succès');
      },
      error: () => this.message.set('Erreur lors de l\'ajustement des objectifs')
    });
  }

  /** Somme des ressources planifiées sur la semaine (matières + fûts), pour la vue "ressources planifiées". */
  totalRessourcesSemaine(): { mais: number; soja: number; arachide: number; poudreTotale: number; futs: number } {
    const p = this.pphSelectionne();
    if (!p) return { mais: 0, soja: 0, arachide: 0, poudreTotale: 0, futs: 0 };
    return p.repartitionJours.reduce((acc, j) => ({
      mais: acc.mais + j.poudreMaisKg, soja: acc.soja + j.poudreSojaKg,
      arachide: acc.arachide + j.poudreArachideKg,
      poudreTotale: acc.poudreTotale + j.poudreTotaleKg,
      futs: acc.futs + j.futsPrevus,
    }), { mais: 0, soja: 0, arachide: 0, poudreTotale: 0, futs: 0 });
  }
}
