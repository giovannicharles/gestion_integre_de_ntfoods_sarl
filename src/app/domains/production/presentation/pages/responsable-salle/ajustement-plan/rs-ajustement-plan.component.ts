import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE } from '../../../../infrastructure/production.service';

/** Ligne éditable de répartition journalière */
interface RepartitionEdition {
  dateJour: string;
  poudreMaisKg: number;
  poudreSojaKg: number;
  poudreArachideKg: number;
  futsPrevus: number;
  sachetsPrevus: number;
  couverclesPrevus: number;
  scellesPrevus: number;
}

@Component({
  selector: 'app-rs-ajustement-plan',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './rs-ajustement-plan.component.html',
  styleUrls: ['./rs-ajustement-plan.component.css', '../_shared.css']
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

  /** Totaux MP calculés depuis les lignes éditées */
  totauxMP = computed(() => {
    const mais     = this.repartitionEdition().reduce((s, j) => s + (j.poudreMaisKg     ?? 0), 0);
    const soja     = this.repartitionEdition().reduce((s, j) => s + (j.poudreSojaKg     ?? 0), 0);
    const arachide = this.repartitionEdition().reduce((s, j) => s + (j.poudreArachideKg ?? 0), 0);
    return { mais, soja, arachide, total: mais + soja + arachide };
  });

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

  selectionner(p: PPHBE): void {
    this.pphSelectionne.set(p);
    const edition = (p.repartitionJours ?? []).map(j => ({
      dateJour:         j.dateJour,
      poudreMaisKg:     j.poudreMaisKg,
      poudreSojaKg:     j.poudreSojaKg,
      poudreArachideKg: j.poudreArachideKg,
      futsPrevus:       j.futsPrevus,
      sachetsPrevus:    j.sachetsPrevus,
      couverclesPrevus: j.couverclesPrevus,
      scellesPrevus:    j.scellesPrevus
    }));
    edition.forEach(j => {
      const total = (j.poudreMaisKg || 0) + (j.poudreSojaKg || 0) + (j.poudreArachideKg || 0);
      j.futsPrevus = total <= 0 ? 0 : total / 50;
    });
    this.repartitionEdition.set(edition);
    this.message.set('');
    this.erreur.set('');
    this.enPause.set(false);
  }

  recalculerFuts(index: number): void {
    this.repartitionEdition.update(arr => {
      const nouvelle = [...arr];
      const j = nouvelle[index];
      if (j) {
        const total = (j.poudreMaisKg || 0) + (j.poudreSojaKg || 0) + (j.poudreArachideKg || 0);
        nouvelle[index] = { ...j, futsPrevus: total <= 0 ? 0 : total / 50 };
      }
      return nouvelle;
    });
  }

  mettreAJourChamp(index: number, champ: keyof RepartitionEdition, valeur: number): void {
    this.repartitionEdition.update(arr => {
      const nouvelle = [...arr];
      const j = nouvelle[index];
      if (j) {
        nouvelle[index] = { ...j, [champ]: valeur } as RepartitionEdition;
      }
      return nouvelle;
    });
  }

  enregistrer(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.saving.set(true);
    this.erreur.set('');
    this.svc.ajusterRepartitionPPH(p.referencePPH, this.repartitionEdition()).subscribe({
      next: updated => {
        this.pphs.update(list => list.map(x => x.referencePPH === updated.referencePPH ? updated : x));
        this.pphSelectionne.set(updated);
        const edition = (updated.repartitionJours ?? []).map(j => ({
          dateJour:         j.dateJour,
          poudreMaisKg:     j.poudreMaisKg,
          poudreSojaKg:     j.poudreSojaKg,
          poudreArachideKg: j.poudreArachideKg,
          futsPrevus:       j.futsPrevus,
          sachetsPrevus:    j.sachetsPrevus,
          couverclesPrevus: j.couverclesPrevus,
          scellesPrevus:    j.scellesPrevus
        }));
        edition.forEach(j => {
          const total = (j.poudreMaisKg || 0) + (j.poudreSojaKg || 0) + (j.poudreArachideKg || 0);
          j.futsPrevus = total <= 0 ? 0 : total / 50;
        });
        this.repartitionEdition.set(edition);
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
