import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService, RetourBE } from '../../../infrastructure/stock.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

/**
 * Comptage des invendus de fin de tournée (2026-11-09) : RetourController existait déjà côté
 * serveur (déclaration par le commercial, comptage par le gestionnaire, écart conservé), sans
 * aucun écran — le sidebar Stock pointait déjà vers /stock/invendus (voir stock-layout, "Comptage
 * Invendus"), une route qui n'existait pas. Aucun mouvement de stock n'est produit ici : les
 * invendus restent dans le stock mobile du commercial jusqu'à une éventuelle action séparée.
 */
@Component({
  selector: 'app-retour-list',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './retour-list.component.html',
  styleUrls: ['./retour-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetourListComponent implements OnInit {
  private readonly svc = inject(StockService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  retours = signal<RetourBE[]>([]);

  search = '';
  filterStatut = '';
  page = signal(1);
  pageSize = 10;

  filtered = computed(() => {
    const q = this.search.trim().toLowerCase();
    return this.retours().filter(r => {
      if (this.filterStatut && r.statut !== this.filterStatut) return false;
      if (!q) return true;
      return r.numero.toLowerCase().includes(q) || r.matriculeCommercial.toLowerCase().includes(q);
    });
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));

  paginated = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  countStatus = (statut: string) => this.retours().filter(r => r.statut === statut).length;

  pagePrecedente(): void {
    if (this.page() > 1) {
      this.page.set(this.page() - 1);
    }
  }

  pageSuivante(): void {
    if (this.page() < this.totalPages()) {
      this.page.set(this.page() + 1);
    }
  }

  exportRetoursCsv(): void {
    const list = this.filtered();
    if (list.length === 0) {
      this.toast.warning('Aucun retour à exporter.', 'Export CSV');
      return;
    }
    const headers = ['N° Retour', 'Commercial', 'Date', 'Statut', 'Nb Lignes'];
    const rows = list.map(r => [
      `"${r.numero || ''}"`,
      `"${r.matriculeCommercial || ''}"`,
      `"${r.dateRetour ? String(r.dateRetour).substring(0, 10) : ''}"`,
      `"${this.statutLabel(r.statut)}"`,
      r.lignes?.length ?? 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `invendus_retours_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.success(`${list.length} retour(s) exporté(s) en CSV.`, 'Export CSV');
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getRetours().subscribe({
      next: l => { this.retours.set(l); this.loading.set(false); },
      error: (err) => { this.loading.set(false); this.toast.error(extractApiError(err), 'Chargement impossible'); },
    });
  }

  // ── Comptage ──────────────────────────────────────────────────────────────
  showComptageModal = signal(false);
  savingComptage = signal(false);
  retourCourant: RetourBE | null = null;
  comptageLignes: { codeProduit: string; declaree: number; comptee: number }[] = [];

  ouvrirComptage(retour: RetourBE): void {
    this.retourCourant = retour;
    this.comptageLignes = retour.lignes.map(l => ({
      codeProduit: l.codeProduit,
      declaree: l.quantiteDeclaree,
      comptee: l.quantiteComptee ?? l.quantiteDeclaree,
    }));
    this.showComptageModal.set(true);
  }

  fermerComptage(): void {
    if (this.savingComptage()) return;
    this.showComptageModal.set(false);
    this.retourCourant = null;
  }

  confirmerComptage(): void {
    const retour = this.retourCourant;
    if (!retour || this.savingComptage()) return;
    this.savingComptage.set(true);
    const lignes = this.comptageLignes.map(l => ({ codeProduit: l.codeProduit, quantiteComptee: l.comptee }));
    this.svc.compterInvendus(retour.numero, lignes).subscribe({
      next: () => {
        this.savingComptage.set(false);
        this.showComptageModal.set(false);
        this.retourCourant = null;
        this.toast.success('Comptage enregistré.');
        this.charger();
      },
      error: (err) => { this.savingComptage.set(false); this.toast.error(extractApiError(err), 'Comptage impossible'); },
    });
  }

  ecartLigne(l: { declaree: number; comptee: number }): number {
    return l.comptee - l.declaree;
  }

  statutLabel(statut: string): string {
    return { DECLARE: 'Déclaré', COMPTE: 'Compté' }[statut] ?? statut;
  }

  statutBadgeClass(statut: string): string {
    return statut === 'COMPTE' ? 'badge badge-success' : 'badge badge-warning';
  }
}
