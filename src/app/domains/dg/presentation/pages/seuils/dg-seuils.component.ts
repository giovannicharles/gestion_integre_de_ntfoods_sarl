import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DgService, SeuilBE, HistoriqueSeuilBE } from '../../../infrastructure/dg.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { SeuilFormModalComponent } from './seuil-form-modal/seuil-form-modal.component';

/**
 * Gouvernance des seuils de réapprovisionnement (P2, 2026-10-15) : écran manquant
 * jusqu'ici, DefinirSeuilUseCase/ListerSeuilsUseCase (backend) n'avaient aucun
 * endpoint ni aucun écran (vérifié par grep avant ce correctif). Backend complété
 * (SeuilController) dans la même tranche. Volontairement dans l'espace DG, jamais
 * dans l'espace Stock opérationnel (§5.4 du contexte projet : « les seuils sont
 * définis par le DG »).
 */
@Component({
  selector: 'app-dg-seuils',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, SeuilFormModalComponent],
  templateUrl: './dg-seuils.component.html',
  styleUrls: ['./dg-seuils.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DgSeuilsComponent implements OnInit {
  private readonly dgSvc = inject(DgService);

  @ViewChild(SeuilFormModalComponent) modal?: SeuilFormModalComponent;

  loading = signal(true);
  loadError = signal<string | null>(null);
  seuils = signal<SeuilBE[]>([]);
  historique = signal<HistoriqueSeuilBE[]>([]);
  activeTab = signal<'seuils' | 'historique'>('seuils');

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
    this.modal?.ouvrir(seuil);
  }

  onSeuilEnregistre(): void {
    this.charger();
  }
}
