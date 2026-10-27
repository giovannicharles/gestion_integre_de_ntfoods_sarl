import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, PPHRepartitionJourBE } from '../../../../infrastructure/production.service';

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
  styleUrls: ['./cp-planification.component.css', '../_shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  /** Somme des ressources planifiées sur la semaine (matières, libres, + fûts), pour la vue "ressources planifiées". */
  totalRessourcesSemaine(): { poudreTotale: number; futs: number } {
    const p = this.pphSelectionne();
    if (!p) return { poudreTotale: 0, futs: 0 };
    return p.repartitionJours.reduce((acc, j) => ({
      poudreTotale: acc.poudreTotale + (j.totalMatieresPremieresKg || 0),
      futs: acc.futs + j.futsPrevus,
    }), { poudreTotale: 0, futs: 0 });
  }

  /** Matières premières d'un jour, formatées « Nom: Qté kg » — liste libre, jamais figée sur maïs/soja/arachide. */
  matieresJour(jour: PPHRepartitionJourBE): string {
    const b = jour.besoinsMatieresPremiere ?? [];
    if (!b.length) return '—';
    return b.map(m => `${m.matierePremiere}: ${(Math.round(m.quantiteKg * 100) / 100)} kg`).join(', ');
  }

  /** Composants d'emballage d'un jour, formatés « Type: Qté ». */
  emballagesJour(jour: PPHRepartitionJourBE): string {
    const b = jour.besoinsEmballage ?? [];
    if (!b.length) return '—';
    return b.map(e => `${e.type}: ${e.quantite}`).join(', ');
  }
}
