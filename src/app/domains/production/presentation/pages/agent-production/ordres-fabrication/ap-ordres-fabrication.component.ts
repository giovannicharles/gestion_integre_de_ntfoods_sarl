import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, OFBE } from '../../../../infrastructure/production.service';

/**
 * ORDRES DE FABRICATION — Agent de Production
 * GET /production/ordres-fabrication (PRODUCTION_OF_CONSULTER) — consultation.
 * PATCH /{idOF}/statut (PRODUCTION_OF_VALIDER) — l'agent peut faire basculer un
 * OF entre brouillon, en pause, en cours et terminé, mais ne peut ni le créer,
 * ni le démarrer depuis zéro, ni l'annuler (réservé à PRODUCTION_OF_CREER).
 */
@Component({
  selector: 'app-ap-ordres-fabrication',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './ap-ordres-fabrication.component.html',
  styleUrls: ['./ap-ordres-fabrication.component.css', '../_shared.css']
})
export class ApOrdresFabricationComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  ofs = signal<OFBE[]>([]);
  statutFiltre = signal<string>('');
  recherche = signal('');
  message = signal('');
  enCours = signal<string | null>(null);

  readonly statuts = ['PLANIFIE', 'EN_COURS', 'EN_PAUSE', 'HONORE', 'ANNULE'];

  /** Statuts que l'agent peut lui-même assigner via PATCH /{idOF}/statut. */
  readonly statutsAssignables = [
    { valeur: 'PLANIFIE', libelle: 'Brouillon' },
    { valeur: 'EN_PAUSE', libelle: 'En pause' },
    { valeur: 'EN_COURS', libelle: 'En cours' },
    { valeur: 'HONORE', libelle: 'Terminé' },
  ];

  ofsFiltres = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    return this.ofs().filter(o =>
      !r || o.idOF.toLowerCase().includes(r) || o.referencePPH.toLowerCase().includes(r) ||
      o.designationProduit.toLowerCase().includes(r) || o.codeProduit.toLowerCase().includes(r)
    );
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getOFs(this.statutFiltre() || undefined).subscribe({
      next: o => { this.ofs.set(o); this.loading.set(false); },
      error: () => { this.ofs.set([]); this.loading.set(false); }
    });
  }

  progression(o: OFBE): number {
    return o.qteDemandee > 0 ? Math.min(100, Math.round((o.qteRealisee / o.qteDemandee) * 100)) : 0;
  }

  badgeStatut(statut: string): string {
    switch (statut) {
      case 'EN_COURS': return 'badge bg-blue';
      case 'EN_PAUSE': return 'badge bg-orange';
      case 'HONORE': return 'badge bg-success';
      case 'PLANIFIE': return 'badge bg-yellow';
      case 'ANNULE': return 'badge bg-red';
      default: return 'badge';
    }
  }

  changerStatut(o: OFBE, cible: string): void {
    if (!cible || cible === o.statut) return;
    this.message.set('');
    this.enCours.set(o.idOF);
    this.svc.changerStatutOF(o.idOF, cible).subscribe({
      next: updated => {
        this.ofs.update(list => list.map(x => x.idOF === updated.idOF ? updated : x));
        this.enCours.set(null);
      },
      error: () => {
        this.message.set(`Transition impossible : un OF ${this.libelleStatut(o.statut)} ne peut pas passer directement à ${this.libelleStatut(cible)}.`);
        this.enCours.set(null);
      }
    });
  }

  private libelleStatut(statut: string): string {
    return this.statutsAssignables.find(s => s.valeur === statut)?.libelle ?? statut;
  }
}
