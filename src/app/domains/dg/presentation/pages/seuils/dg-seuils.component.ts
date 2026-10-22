import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DgService, SeuilBE, HistoriqueSeuilBE, DefinirSeuilRequestBE } from '../../../infrastructure/dg.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

/**
 * Gouvernance des seuils de réapprovisionnement (P2, 2026-10-15) : écran manquant
 * jusqu'ici — DefinirSeuilUseCase/ListerSeuilsUseCase (backend) n'avaient aucun
 * endpoint ni aucun écran (vérifié par grep avant ce correctif). Backend complété
 * (SeuilController) dans la même tranche. Volontairement dans l'espace DG, jamais
 * dans l'espace Stock opérationnel (§5.4 du contexte projet : « les seuils sont
 * définis par le DG »).
 */
@Component({
  selector: 'app-dg-seuils',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './dg-seuils.component.html',
  styleUrls: ['./dg-seuils.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DgSeuilsComponent implements OnInit {
  private readonly dgSvc = inject(DgService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  seuils = signal<SeuilBE[]>([]);
  historique = signal<HistoriqueSeuilBE[]>([]);
  activeTab = signal<'seuils' | 'historique'>('seuils');

  showForm = signal(false);
  saving = signal(false);
  formCodeProduit = signal('');
  formTypeEntrepot = signal<'CENTRAL' | 'TAMPON' | 'MOBILE'>('CENTRAL');
  formValeur = signal<number | null>(null);

  seuilsTries = computed(() =>
    [...this.seuils()].sort((a, b) => a.codeProduit.localeCompare(b.codeProduit) || a.typeEntrepot.localeCompare(b.typeEntrepot))
  );

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.dgSvc.getSeuils().subscribe({
      next: s => {
        this.seuils.set(s);
        this.dgSvc.getHistoriqueSeuils().subscribe({
          next: h => { this.historique.set(h); this.loading.set(false); },
          error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
        });
      },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  ouvrirFormulaire(seuil?: SeuilBE): void {
    this.formCodeProduit.set(seuil?.codeProduit ?? '');
    this.formTypeEntrepot.set(seuil?.typeEntrepot ?? 'CENTRAL');
    this.formValeur.set(seuil?.seuilReapprovisionnement ?? null);
    this.showForm.set(true);
  }

  fermerFormulaire(): void {
    this.showForm.set(false);
  }

  enregistrer(): void {
    const codeProduit = this.formCodeProduit().trim().toUpperCase();
    const valeur = this.formValeur();
    if (!codeProduit || valeur === null || valeur < 0) {
      this.toast.error('Code produit et valeur (≥ 0) obligatoires.', 'Formulaire incomplet');
      return;
    }
    const request: DefinirSeuilRequestBE = {
      codeProduit,
      typeEntrepot: this.formTypeEntrepot(),
      seuilReapprovisionnement: valeur,
    };
    this.saving.set(true);
    this.dgSvc.definirSeuil(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.toast.success(`Seuil ${codeProduit} / ${request.typeEntrepot} enregistré.`);
        this.charger();
      },
      error: e => {
        this.saving.set(false);
        this.toast.error(extractApiError(e), 'Échec de l\'enregistrement');
      },
    });
  }
}
