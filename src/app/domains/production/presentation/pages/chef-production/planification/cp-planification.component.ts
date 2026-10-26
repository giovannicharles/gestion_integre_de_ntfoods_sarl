import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, PPHRepartitionJourBE } from '../../../../infrastructure/production.service';
import { BesoinsParJourComponent } from '../../../shared/besoins-par-jour/besoins-par-jour.component';
import { nomsMatieres, qteMatiere, totalKg } from '../../../../infrastructure/production-besoins.util';

interface LigneObjectif {
  codeProduit: string;
  nomProduit: string;
  productionRealisee: number;
  objectifInitial: number;
  objectif: number;
}

/**
 * PLANIFICATION DE LA PRODUCTION — Chef de Production.
 *
 * Répartition journalière du plan sélectionné, ajustement des objectifs par
 * produit (PUT /production/pph/{ref}/lignes) et ressources planifiées.
 */
@Component({
  selector: 'app-cp-planification',
  standalone: true,
  imports: [BesoinsParJourComponent, CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './cp-planification.component.html',
  styleUrls: ['./cp-planification.component.css', '../_shared.css']
})
export class CpPlanificationComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  enregistrement = signal(false);
  message = signal('');
  erreur = signal('');
  detailOuvert = signal(false);

  plans = signal<PPHBE[]>([]);
  plan = signal<PPHBE | null>(null);

  lignes = signal<LigneObjectif[]>([]);

  readonly statuts: Record<string, string> = {
    BROUILLON: 'Brouillon', VALIDE: 'Validé', EN_COURS: 'En cours', CLOTURE: 'Clôturé',
  };

  /** Le plan peut être ajusté tant qu'il n'est pas clôturé. */
  modifiable = computed(() => !!this.plan() && this.plan()?.statut !== 'CLOTURE');

  modifie = computed(() => this.lignes().some(l => l.objectif !== l.objectifInitial));
  nbModifies = computed(() => this.lignes().filter(l => l.objectif !== l.objectifInitial).length);

  objectifTotal = computed(() => this.lignes().reduce((s, l) => s + (Number(l.objectif) || 0), 0));
  realiseTotal = computed(() => this.lignes().reduce((s, l) => s + l.productionRealisee, 0));
  avancement = computed(() => {
    const obj = this.objectifTotal();
    return obj > 0 ? Math.min(100, Math.round((this.realiseTotal() / obj) * 100)) : 0;
  });

  jours = computed<PPHRepartitionJourBE[]>(() => this.plan()?.repartitionJours ?? []);
  futsTotal = computed(() => this.jours().reduce((s, j) => s + (j.futsPrevus || 0), 0));
  matieresTotalKg = computed(() => this.jours().reduce((s, j) => s + totalKg(j.besoinsMatieresPremiere), 0));
  emballagesTotal = computed(() => this.jours().reduce((s, j) => s + j.besoinsEmballage.reduce((t, b) => t + b.quantite, 0), 0));
  maxKgJour = computed(() => Math.max(1, ...this.jours().map(j => totalKg(j.besoinsMatieresPremiere))));

  matieresResume = computed(() => {
    const listes = this.jours().map(j => j.besoinsMatieresPremiere);
    return nomsMatieres(listes)
      .map(nom => ({ nom, quantite: listes.reduce((s, l) => s + qteMatiere(l, nom), 0) }))
      .filter(m => m.quantite > 0);
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.erreur.set('');
    this.svc.getPPHs().subscribe({
      next: list => {
        const tries = [...list].sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''));
        this.plans.set(tries);
        this.loading.set(false);
        const defaut = tries.find(p => p.statut === 'EN_COURS')
          ?? tries.find(p => p.statut === 'VALIDE')
          ?? tries.find(p => p.statut === 'BROUILLON')
          ?? tries[0] ?? null;
        if (defaut) this.selectionner(defaut.referencePPH);
        else this.plan.set(null);
      },
      error: () => { this.erreur.set('Impossible de charger les plans de production.'); this.loading.set(false); }
    });
  }

  selectionner(reference: string): void {
    if (!reference) return;
    this.svc.getPPH(reference).subscribe({
      next: p => { this.plan.set(p); this.initialiserLignes(p); this.message.set(''); },
      error: () => this.erreur.set(`Impossible de charger le plan ${reference}.`),
    });
  }

  private initialiserLignes(p: PPHBE): void {
    this.lignes.set(p.lignes.map(l => ({
      codeProduit: l.codeProduit,
      nomProduit: l.nomProduit,
      productionRealisee: l.productionRealisee,
      objectifInitial: l.objectifSemaine,
      objectif: l.objectifSemaine,
    })));
  }

  /** Mise à jour immuable : indispensable pour que les calculs dérivés et la barre d'enregistrement suivent la saisie. */
  majObjectif(codeProduit: string, valeur: number | null): void {
    this.lignes.update(liste => liste.map(l => l.codeProduit === codeProduit ? { ...l, objectif: Number(valeur) } : l));
  }

  /** Remet les objectifs saisis à leur valeur enregistrée. */
  annuler(): void {
    const p = this.plan();
    if (p) this.initialiserLignes(p);
  }

  enregistrer(): void {
    const p = this.plan();
    if (!p || !this.modifie() || this.enregistrement()) return;
    const invalide = this.lignes().find(l => !(Number(l.objectif) > 0));
    if (invalide) {
      this.erreur.set(`L'objectif de ${invalide.codeProduit} doit être supérieur à zéro.`);
      return;
    }
    this.enregistrement.set(true);
    this.erreur.set('');
    this.svc.modifierLignesPPH(p.referencePPH, this.lignes().map(l => ({
      codeProduit: l.codeProduit, objectifSemaine: Number(l.objectif),
    }))).subscribe({
      next: maj => {
        this.plans.update(list => list.map(x => x.referencePPH === maj.referencePPH ? maj : x));
        this.plan.set(maj);
        this.initialiserLignes(maj);
        this.enregistrement.set(false);
        this.message.set('Objectifs enregistrés. Le calendrier reste à recalculer si les quantités ont changé.');
      },
      error: e => {
        this.enregistrement.set(false);
        this.erreur.set(e?.error?.erreur || e?.error?.message || 'Enregistrement des objectifs impossible.');
      }
    });
  }

  libelleStatut(s: string | undefined): string {
    return this.statuts[s ?? ''] ?? (s ?? '—');
  }

  statutClass(s: string | undefined): string {
    return ({
      BROUILLON: 'cpl-statut cpl-statut-brouillon', VALIDE: 'cpl-statut cpl-statut-valide',
      EN_COURS: 'cpl-statut cpl-statut-encours', CLOTURE: 'cpl-statut cpl-statut-cloture',
    } as Record<string, string>)[s ?? ''] ?? 'cpl-statut';
  }

  progression(realise: number, objectif: number): number {
    return objectif > 0 ? Math.min(100, Math.round((realise / objectif) * 100)) : 0;
  }

  /** Hauteur relative de la barre d'un jour, par rapport au jour le plus chargé. */
  hauteurJour(j: PPHRepartitionJourBE): number {
    return Math.max(4, Math.round((totalKg(j.besoinsMatieresPremiere) / this.maxKgJour()) * 100));
  }

  libelleJour(iso: string): string {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  qteMatiere(j: PPHRepartitionJourBE, nom: string): number {
    return qteMatiere(j.besoinsMatieresPremiere, nom);
  }

  readonly totalKg = totalKg;

  emballageJour(j: PPHRepartitionJourBE): number {
    return j.besoinsEmballage.reduce((s, b) => s + b.quantite, 0);
  }

  trackJour = (_: number, j: PPHRepartitionJourBE) => j.dateJour;
}
