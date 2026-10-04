import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService, NiveauStockBE, TransfertBE } from '../../../infrastructure/stock.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ToastService } from '../../../../../core/services/toast.service';

interface LigneSaisie {
  codeProduit: string;
  sku: string | null;
  designation: string;
  disponible: number;
  quantite: number | null;
}

/**
 * Demander un transfert central → tampon (2026-09-30) — écran absent jusqu'ici : le seul chemin qui déplaçait
 * réellement le stock (`transfer-to-buffer`) n'était appelé par aucun composant, et le chemin correct
 * (`POST /api/stock/transferts`, approbation obligatoire — CLAUDE.md invariant 1) n'avait donc aucune interface.
 * Le stock ne bouge PAS à la soumission : une demande est créée, à valider depuis « Mes validations ».
 */
@Component({
  selector: 'app-demande-transfert',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './demande-transfert.component.html',
  styleUrls: ['./demande-transfert.component.css'],
})
export class DemandeTransfertComponent implements OnInit {
  private readonly stockService = inject(StockService);
  private readonly toast = inject(ToastService);

  loading = signal(false);
  error = signal<string | null>(null);
  soumission = false;

  niveauxCentral = signal<NiveauStockBE[]>([]);
  recherche = '';
  filtres = computed(() =>
    this.niveauxCentral().filter(
      (n) =>
        !this.recherche ||
        n.designation.toLowerCase().includes(this.recherche.toLowerCase()) ||
        n.codeProduit.toLowerCase().includes(this.recherche.toLowerCase())
    )
  );

  lignesChoisies = signal<LigneSaisie[]>([]);

  historique = signal<TransfertBE[]>([]);
  chargementHistorique = signal(false);

  ngOnInit() {
    this.chargerNiveaux();
    this.chargerHistorique();
  }

  chargerNiveaux() {
    this.loading.set(true);
    this.error.set(null);
    this.stockService.getEtatStock({}).subscribe({
      next: (niveaux) => {
        this.niveauxCentral.set(niveaux.filter((n) => n.typeEntrepot === 'CENTRAL' && n.quantite > 0));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractApiError(err));
        this.loading.set(false);
      },
    });
  }

  private chargerHistorique() {
    this.chargementHistorique.set(true);
    this.stockService.listerTransfertsExecutes().subscribe({
      next: (t) => {
        this.historique.set(t);
        this.chargementHistorique.set(false);
      },
      error: () => this.chargementHistorique.set(false),
    });
  }

  ajouterLigne(n: NiveauStockBE) {
    if (this.lignesChoisies().some((l) => l.codeProduit === n.codeProduit)) {
      this.toast.info(`${n.designation} est déjà dans la demande.`);
      return;
    }
    this.lignesChoisies.update((lignes) => [
      ...lignes,
      { codeProduit: n.codeProduit, sku: null, designation: n.designation, disponible: n.quantite, quantite: null },
    ]);
  }

  retirerLigne(codeProduit: string) {
    this.lignesChoisies.update((lignes) => lignes.filter((l) => l.codeProduit !== codeProduit));
  }

  peutSoumettre(): boolean {
    const lignes = this.lignesChoisies();
    if (lignes.length === 0) return false;
    return lignes.every((l) => l.quantite !== null && l.quantite > 0 && l.quantite <= l.disponible);
  }

  soumettre() {
    if (!this.peutSoumettre() || this.soumission) return;
    this.soumission = true;
    const lignes = this.lignesChoisies().map((l) => ({ codeProduit: l.codeProduit, sku: l.sku, quantite: l.quantite! }));

    this.stockService.demanderTransfert(lignes).subscribe({
      next: (demande) => {
        this.soumission = false;
        this.lignesChoisies.set([]);
        this.toast.success(
          `Demande créée — le stock n'a pas bougé, en attente de validation (seuil requis : ${demande.seuilRequis}).`,
          'Demande de transfert envoyée'
        );
        this.chargerNiveaux();
      },
      error: (err) => {
        this.soumission = false;
        this.toast.error(extractApiError(err), 'Demande impossible');
      },
    });
  }

  formatDate(dateStr: string | null): string {
    return dateStr ? new Date(dateStr).toLocaleString('fr-FR') : '—';
  }
}
