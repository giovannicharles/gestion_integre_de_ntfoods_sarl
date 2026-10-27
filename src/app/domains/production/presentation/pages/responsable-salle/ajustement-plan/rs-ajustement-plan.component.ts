import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, PPHRepartitionJourBE } from '../../../../infrastructure/production.service';
import { nomsMatieres, typesEmballage, qteMatiere, qteEmballage, libelleEmballage } from '../../../../infrastructure/production-besoins.util';

/** Ligne éditable de répartition journalière — matières et emballage en listes libres (jamais figées). */
interface RepartitionEdition {
  dateJour: string;
  matieres: { matierePremiere: string; quantiteKg: number }[];
  futsPrevus: number;
  emballage: { type: string; quantite: number }[];
}

@Component({
  selector: 'app-rs-ajustement-plan',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './rs-ajustement-plan.component.html',
  styleUrls: ['./rs-ajustement-plan.component.css', '../_shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RsAjustementPlanComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading    = signal(true);
  saving     = signal(false);
  actionning = signal(false);
  message    = signal('');
  erreur     = signal('');

  pphs           = signal<PPHBE[]>([]);
  pphSelectionne = signal<PPHBE | null>(null);
  enPause        = signal(false);

  /** Copie éditable de la répartition journalière */
  repartitionEdition = signal<RepartitionEdition[]>([]);

  pphsActifs = computed(() =>
    this.pphs().filter(p => p.statut !== 'CLOTURE')
  );

  /** Noms de matières présents dans la répartition éditée, dans l'ordre de première apparition (jamais figé). */
  colonnesMP = computed(() => nomsMatieres(this.repartitionEdition().map(j => j.matieres)));

  /** Types d'emballage présents dans la répartition éditée. */
  colonnesEmballage = computed(() => typesEmballage(this.repartitionEdition().map(j => j.emballage)));

  libelleEmballage = libelleEmballage;

  /** Totaux par matière + total global, calculés depuis les lignes éditées. */
  totauxMP = computed(() => {
    const parMatiere = this.colonnesMP().map(nom => ({
      nom, total: this.repartitionEdition().reduce((s, j) => s + qteMatiere(j.matieres, nom), 0),
    }));
    return { parMatiere, total: parMatiere.reduce((s, m) => s + m.total, 0) };
  });

  quantiteMatiere(index: number, nom: string): number {
    return qteMatiere(this.repartitionEdition()[index]?.matieres, nom);
  }

  definirQuantiteMatiere(index: number, nom: string, valeur: number): void {
    this.repartitionEdition.update(arr => {
      const nouvelle = [...arr];
      const j = nouvelle[index];
      if (!j) return arr;
      const matieres = j.matieres.filter(m => m.matierePremiere !== nom);
      matieres.push({ matierePremiere: nom, quantiteKg: valeur });
      nouvelle[index] = { ...j, matieres };
      return nouvelle;
    });
    this.recalculerFuts(index);
  }

  quantiteEmballage(index: number, type: string): number {
    return qteEmballage(this.repartitionEdition()[index]?.emballage, type);
  }

  definirQuantiteEmballage(index: number, type: string, valeur: number): void {
    this.repartitionEdition.update(arr => {
      const nouvelle = [...arr];
      const j = nouvelle[index];
      if (!j) return arr;
      const emballage = j.emballage.filter(e => e.type !== type);
      emballage.push({ type, quantite: valeur });
      nouvelle[index] = { ...j, emballage };
      return nouvelle;
    });
  }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs().subscribe({
      next: list => {
        const actifs = list.filter(p => p.statut !== 'CLOTURE');
        this.pphs.set(actifs);
        const brouillons = actifs.filter(p => p.statut === 'BROUILLON');
        if (brouillons.length) this.selectionner(brouillons[0]);
        else if (actifs.length) this.selectionner(actifs[0]);
        this.loading.set(false);
      },
      error: () => { this.erreur.set('Impossible de charger les plans.'); this.loading.set(false); }
    });
  }

  private versEdition(j: PPHRepartitionJourBE): RepartitionEdition {
    const matieres = (j.besoinsMatieresPremiere ?? []).map(m => ({ ...m }));
    const emballage = (j.besoinsEmballage ?? []).map(e => ({ ...e }));
    const total = matieres.reduce((s, m) => s + (m.quantiteKg || 0), 0);
    return { dateJour: j.dateJour, matieres, emballage, futsPrevus: total <= 0 ? 0 : total / 50 };
  }

  selectionner(p: PPHBE): void {
    this.pphSelectionne.set(p);
    this.repartitionEdition.set((p.repartitionJours ?? []).map(j => this.versEdition(j)));
    this.message.set('');
    this.erreur.set('');
    this.enPause.set(false);
  }

  recalculerFuts(index: number): void {
    this.repartitionEdition.update(arr => {
      const nouvelle = [...arr];
      const j = nouvelle[index];
      if (j) {
        const total = j.matieres.reduce((s, m) => s + (m.quantiteKg || 0), 0);
        nouvelle[index] = { ...j, futsPrevus: total <= 0 ? 0 : total / 50 };
      }
      return nouvelle;
    });
  }

  enregistrer(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.saving.set(true);
    this.erreur.set('');
    const repartition = this.repartitionEdition().map(j => ({
      dateJour: j.dateJour, futsPrevus: j.futsPrevus,
      besoinsMatieresPremiere: j.matieres, besoinsEmballage: j.emballage,
    }));
    this.svc.ajusterRepartitionPPH(p.referencePPH, repartition).subscribe({
      next: updated => {
        this.pphs.update(list => list.map(x => x.referencePPH === updated.referencePPH ? updated : x));
        this.pphSelectionne.set(updated);
        this.repartitionEdition.set((updated.repartitionJours ?? []).map(j => this.versEdition(j)));
        this.message.set('Ajustements enregistrés avec succès.');
        this.saving.set(false);
      },
      error: () => { this.erreur.set('Erreur lors de l\'enregistrement.'); this.saving.set(false); }
    });
  }

  demarrer(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.actionning.set(true);
    this.erreur.set('');
    this.svc.demarrerPPH(p.referencePPH).subscribe({
      next: updated => {
        this.pphs.update(list => list.map(x => x.referencePPH === updated.referencePPH ? updated : x));
        this.pphSelectionne.set(updated);
        this.message.set('Production démarrée — PPH EN COURS.');
        this.actionning.set(false);
        this.enPause.set(false);
      },
      error: (err) => {
        this.erreur.set(err?.error?.message ?? 'Le PPH doit être validé par le Chef de Production avant d\'être démarré.');
        this.actionning.set(false);
      }
    });
  }

  togglePause(): void {
    this.enPause.update(v => !v);
    this.message.set(this.enPause() ? 'Production mise en pause.' : 'Production reprise.');
  }

  cloturer(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.actionning.set(true);
    this.erreur.set('');
    this.svc.cloturerPPH(p.referencePPH).subscribe({
      next: updated => {
        this.pphs.update(list => list.filter(x => x.referencePPH !== updated.referencePPH));
        this.pphSelectionne.set(null);
        this.repartitionEdition.set([]);
        this.message.set(`PPH ${updated.referencePPH} clôturé avec succès.`);
        this.actionning.set(false);
        const suivant = this.pphsActifs()[0];
        if (suivant) this.selectionner(suivant);
      },
      error: () => { this.erreur.set('Erreur lors de la clôture.'); this.actionning.set(false); }
    });
  }

  statutClass(s: string): string {
    if (s === 'EN_COURS') return 'badge bg-orange';
    if (s === 'VALIDE')   return 'badge bg-neutral';
    return 'badge bg-neutral';
  }

  progression(realise: number, prevu: number): number {
    if (!prevu) return 0;
    return Math.min(Math.round((realise / prevu) * 100), 100);
  }
}
