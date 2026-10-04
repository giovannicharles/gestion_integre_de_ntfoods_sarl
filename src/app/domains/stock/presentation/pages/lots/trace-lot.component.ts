import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ApiResponse } from '../../../../../core/models/api-response.model';

interface NoeudLot {
  id: number;
  numeroLot: string;
  codeProduit: string;
  sku: string | null;
  codeEntrepot: string;
  statut: string;
  quantiteInitiale: number;
  quantiteRestante: number;
}

interface ArcGenealogie {
  lotParentId: number;
  lotParentNumero: string;
  lotEnfantId: number;
  lotEnfantNumero: string;
  quantiteEnBase: number;
  typeRelation: string;
  reference: string | null;
  matriculeActeur: string | null;
  dateCreation: string;
}

interface TraceLotResponse {
  numeroLotDepart: string;
  noeuds: NoeudLot[];
  arcs: ArcGenealogie[];
  tronque: boolean;
}

const LIBELLES_RELATION: Record<string, string> = {
  CONSOMMATION_MP: 'matière première consommée pour produire',
  TRANSFERT_ENTREPOT: 'transféré vers',
};

/**
 * Parcours d'un lot (2026-09-30) — nouvel écran : le backend `GET /api/stock/lots/{numeroLot}/trace` (amont =
 * matières consommées, aval = transferts/lots fils) n'avait aucune interface. Volontairement séparé de l'écran
 * « Lots » existant (`/stock/lots`) : celui-ci lit `stock/batches` (l'ancien modèle anglais `StockBatch`), un
 * grand livre différent de `LotStock` (`stock/lots`, français) que cette trace parcourt réellement — les mêler
 * aurait affiché « lot introuvable » pour la plupart des numéros du premier écran.
 */
@Component({
  selector: 'app-trace-lot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trace-lot.component.html',
  styleUrls: ['./trace-lot.component.css'],
})
export class TraceLotComponent {
  private readonly api = inject(ApiService);

  numeroLot = '';
  loading = signal(false);
  error = signal<string | null>(null);
  recherchee = signal(false);
  trace = signal<TraceLotResponse | null>(null);

  libelleRelation(type: string): string {
    return LIBELLES_RELATION[type] ?? type;
  }

  noeud(id: number): NoeudLot | undefined {
    return this.trace()?.noeuds.find((n) => n.id === id);
  }

  amonts(): ArcGenealogie[] {
    const depart = this.trace()?.noeuds.find((n) => n.numeroLot === this.trace()?.numeroLotDepart);
    if (!depart) return [];
    return this.trace()!.arcs.filter((a) => a.lotEnfantId === depart.id);
  }

  avals(): ArcGenealogie[] {
    const depart = this.trace()?.noeuds.find((n) => n.numeroLot === this.trace()?.numeroLotDepart);
    if (!depart) return [];
    return this.trace()!.arcs.filter((a) => a.lotParentId === depart.id);
  }

  tracer() {
    if (!this.numeroLot.trim() || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.recherchee.set(true);
    this.trace.set(null);

    this.api.get<ApiResponse<TraceLotResponse>>(`stock/lots/${encodeURIComponent(this.numeroLot.trim())}/trace`).subscribe({
      next: (r) => {
        this.trace.set(r.donnees ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractApiError(err));
        this.loading.set(false);
      },
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('fr-FR');
  }
}
