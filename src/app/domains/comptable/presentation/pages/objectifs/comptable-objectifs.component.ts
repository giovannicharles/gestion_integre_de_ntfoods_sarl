import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ComptableService, ObjectifCommercialBE, PrimeSemaineBE } from '../../../infrastructure/comptable.service';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-comptable-objectifs',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './comptable-objectifs.component.html',
  styleUrls: ['./comptable-objectifs.component.css']
})
export class ComptableObjectifsComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;
  private readonly cptSvc = inject(ComptableService);

  objectifs = signal<ObjectifCommercialBE[]>([]);

  /** Réalisations de la semaine, indexées par matricule. */
  private realisations = signal<Map<string, number>>(new Map());

  /** Chiffre d'affaires réellement réalisé par un commercial sur la semaine. */
  realiseDe(matricule: string): number {
    return this.realisations().get(matricule) ?? 0;
  }

  totalCA = computed(() =>
    Array.from(this.realisations().values()).reduce((s, v) => s + v, 0)
  );

  totalObjectif = computed(() =>
    this.objectifs().reduce((s, o) => s + o.objectifGlobalFCFA, 0)
  );

  /** Gammes effectivement couvertes par l'objectif, telles que fixées côté siège. */
  gammesDe(o: ObjectifCommercialBE): string {
    const gammes = Object.keys(o.objectifsParGammeFCFA ?? {});
    return gammes.length ? gammes.join(', ') : '—';
  }

  /**
   * Détail de la dernière révision. Un objectif abaissé en cours de semaine reste
   * la base du calcul de prime : il doit au moins être signalé comme tel.
   */
  titreRevision(o: ObjectifCommercialBE): string {
    const derniere = o.revisions?.[o.revisions.length - 1];
    if (!derniere) return '';
    const sens = derniere.abaissement ? 'abaissé' : 'relevé';
    return `Objectif ${sens} de ${fCFA(derniere.objectifGlobalAvantFCFA)} à `
      + `${fCFA(derniere.objectifGlobalApresFCFA)} par ${derniere.matriculeAuteur}`
      + (derniere.motif ? ` — ${derniere.motif}` : '')
      + ` (initial : ${fCFA(o.objectifGlobalInitialFCFA)})`;
  }

  tauxGlobal = computed(() =>
    tauxAtteinte(this.totalCA(), this.totalObjectif())
  );

  /** Commerciaux ayant atteint leur objectif hebdomadaire. */
  nbAtteints = computed(() =>
    this.objectifs().filter(o =>
      o.objectifGlobalFCFA > 0 && this.realiseDe(o.matriculeCommercial) >= o.objectifGlobalFCFA
    ).length
  );

  ngOnInit(): void {
    const today = new Date();
    const lundi = new Date(today);
    lundi.setDate(today.getDate() - today.getDay() + 1);
    const semaineDebut = lundi.toISOString().split('T')[0];

    // Les objectifs portent la cible, les primes portent la réalisation calculée
    // par le serveur : les deux sont nécessaires pour un taux d'atteinte exact.
    forkJoin({
      objectifs: this.cptSvc.getObjectifsParSemaine(semaineDebut),
      primes: this.cptSvc.getPrimesParSemaine(semaineDebut),
    }).subscribe({
      next: ({ objectifs, primes }) => {
        this.objectifs.set(objectifs);
        this.realisations.set(this.indexerRealisations(primes));
      },
      error: () => {},
    });
  }

  private indexerRealisations(primes: PrimeSemaineBE[]): Map<string, number> {
    const index = new Map<string, number>();
    for (const p of primes) {
      index.set(p.matriculeCommercial, p.totalVentesGlobalFCFA);
    }
    return index;
  }

  progressClass(ca: number, obj: number): string {
    const t = tauxAtteinte(ca, obj);
    if (t >= 100) return 'prog-bar prog-g';
    if (t >= 75) return 'prog-bar prog-y';
    return 'prog-bar prog-r';
  }

  statutClass(ca: number, obj: number): string {
    return ca >= obj ? 'badge bg-success' : 'badge bg-orange';
  }

  cappedTaux(ca: number, obj: number): number {
    return Math.min(tauxAtteinte(ca, obj), 100);
  }
}
