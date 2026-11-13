import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import {
  SecretaireService, PetiteCaisseResponse, MicroStockResponse, MicroStockMouvementResponse,
} from '../../../infrastructure/secretaire.service';

@Component({
  selector: 'app-secretaire-caisse',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './secretaire-caisse.component.html',
  styleUrls: ['./secretaire-caisse.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaireCaisseComponent implements OnInit {
  private readonly svc = inject(SecretaireService);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = fCFA;
  loading = signal(false);

  petiteCaisse = signal<PetiteCaisseResponse[]>([]);
  microStock = signal<MicroStockResponse[]>([]);

  searchQuery = signal<string>('');
  filtreType = signal<'TOUS' | 'ENTREE' | 'SORTIE'>('TOUS');

  readonly petiteCaisseFiltree = computed(() => {
    let list = this.petiteCaisse();
    const q = this.searchQuery().trim().toLowerCase();
    const t = this.filtreType();

    if (q) {
      list = list.filter(p =>
        p.libelle.toLowerCase().includes(q) ||
        (p.categorie && p.categorie.toLowerCase().includes(q))
      );
    }
    if (t !== 'TOUS') {
      list = list.filter(p => p.type === t);
    }
    return list;
  });

  totalEntrees = computed(() => this.petiteCaisse().filter(p => p.type === 'ENTREE').reduce((s, p) => s + p.montant, 0));
  totalSorties = computed(() => this.petiteCaisse().filter(p => p.type === 'SORTIE').reduce((s, p) => s + p.montant, 0));
  soldeCaisse = computed(() => this.totalEntrees() - this.totalSorties());
  valeurMicroStock = computed(() => this.microStock().reduce((s, m) => s + m.qte * m.prixUnite, 0));

  // ── Billetage & Arrêté de Caisse Journalier ────────────────────────────────
  showBilletageModal = signal(false);
  billets10000 = signal(0);
  billets5000 = signal(0);
  billets2000 = signal(0);
  billets1000 = signal(0);
  billets500 = signal(0);
  pieces = signal(0);

  readonly totalPhysique = computed(() =>
    (this.billets10000() * 10000) +
    (this.billets5000() * 5000) +
    (this.billets2000() * 2000) +
    (this.billets1000() * 1000) +
    (this.billets500() * 500) +
    this.pieces()
  );

  readonly ecartCaisse = computed(() => this.totalPhysique() - this.soldeCaisse());

  // ── Mouvement de caisse ──────────────────────────────────────────────────
  showMouvementModal = signal(false);
  savingMouvement = signal(false);
  mouvementForm = { libelle: '', type: 'ENTREE' as 'ENTREE' | 'SORTIE', montant: 0, heure: '', categorie: '' };

  // ── Article micro-stock ──────────────────────────────────────────────────
  showArticleModal = signal(false);
  savingArticle = signal(false);
  articleForm = { code: '', designation: '', qte: 0, prixUnite: 0, seuil: 0 };

  // ── Ajustement micro-stock ───────────────────────────────────────────────
  showAjusterModal = signal(false);
  savingAjuster = signal(false);
  articleCourant: MicroStockResponse | null = null;
  ajusterForm = { delta: 0, motif: '' };

  // ── Historique ────────────────────────────────────────────────────────────
  showHistoriqueModal = signal(false);
  historique = signal<MicroStockMouvementResponse[]>([]);
  chargementHistorique = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getPetiteCaisse().subscribe({ next: l => this.petiteCaisse.set(l || []), error: () => {} });
    this.svc.getMicroStock().subscribe({
      next: l => { this.microStock.set(l || []); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  // ── Billetage ────────────────────────────────────────────────────────────
  ouvrirBilletage(): void {
    this.showBilletageModal.set(true);
  }
  fermerBilletage(): void {
    this.showBilletageModal.set(false);
  }
  lancerImpressionBilletage(): void {
    window.print();
  }

  // ── Mouvement de caisse ──────────────────────────────────────────────────
  ouvrirMouvement(): void {
    this.mouvementForm = { libelle: '', type: 'ENTREE', montant: 0, heure: '', categorie: '' };
    this.showMouvementModal.set(true);
  }
  fermerMouvement(): void { this.showMouvementModal.set(false); }
  confirmerMouvement(): void {
    const f = this.mouvementForm;
    if (!f.libelle.trim() || f.montant <= 0 || this.savingMouvement()) return;
    this.savingMouvement.set(true);
    this.svc.enregistrerMouvementCaisse(f.libelle.trim(), f.type, f.montant, f.heure || undefined, f.categorie || undefined).subscribe({
      next: () => {
        this.savingMouvement.set(false);
        this.showMouvementModal.set(false);
        this.toast.success('Mouvement de caisse enregistré.');
        this.charger();
      },
      error: (err) => { this.savingMouvement.set(false); this.toast.error(extractApiError(err), 'Enregistrement impossible'); },
    });
  }

  // ── Article micro-stock ──────────────────────────────────────────────────
  ouvrirArticle(): void {
    this.articleForm = { code: '', designation: '', qte: 0, prixUnite: 0, seuil: 0 };
    this.showArticleModal.set(true);
  }
  fermerArticle(): void { this.showArticleModal.set(false); }
  confirmerArticle(): void {
    const f = this.articleForm;
    if (!f.code.trim() || !f.designation.trim() || this.savingArticle()) return;
    this.savingArticle.set(true);
    this.svc.creerArticleMicroStock(f.code.trim(), f.designation.trim(), f.qte, f.prixUnite, f.seuil).subscribe({
      next: () => {
        this.savingArticle.set(false);
        this.showArticleModal.set(false);
        this.toast.success('Article créé.');
        this.charger();
      },
      error: (err) => { this.savingArticle.set(false); this.toast.error(extractApiError(err), 'Création impossible'); },
    });
  }

  // ── Ajustement ────────────────────────────────────────────────────────────
  ouvrirAjuster(article: MicroStockResponse, sens: 'vente' | 'reappro'): void {
    this.articleCourant = article;
    this.ajusterForm = { delta: sens === 'vente' ? -1 : 1, motif: '' };
    this.showAjusterModal.set(true);
  }
  fermerAjuster(): void { this.showAjusterModal.set(false); this.articleCourant = null; }
  confirmerAjuster(): void {
    const article = this.articleCourant;
    const f = this.ajusterForm;
    if (!article || f.delta === 0 || this.savingAjuster()) return;
    this.savingAjuster.set(true);
    this.svc.ajusterMicroStock(article.id, f.delta, f.motif || undefined).subscribe({
      next: () => {
        this.savingAjuster.set(false);
        this.showAjusterModal.set(false);
        this.articleCourant = null;
        this.toast.success('Quantité ajustée.');
        this.charger();
      },
      error: (err) => { this.savingAjuster.set(false); this.toast.error(extractApiError(err), 'Ajustement impossible'); },
    });
  }

  // ── Historique ────────────────────────────────────────────────────────────
  voirHistorique(article: MicroStockResponse): void {
    this.articleCourant = article;
    this.showHistoriqueModal.set(true);
    this.chargementHistorique.set(true);
    this.svc.getMouvementsMicroStock(article.id).subscribe({
      next: l => { this.historique.set(l); this.chargementHistorique.set(false); },
      error: () => this.chargementHistorique.set(false),
    });
  }
  fermerHistorique(): void { this.showHistoriqueModal.set(false); this.historique.set([]); this.articleCourant = null; }

  // ── Export CSV ────────────────────────────────────────────────────────────
  exporterCsvCaisse(): void {
    const list = this.petiteCaisseFiltree();
    let csv = 'Libelle;Type;Montant_FCFA;Heure;Categorie\n';
    list.forEach(p => {
      csv += `"${p.libelle}";"${p.type}";"${p.montant}";"${p.heure || ''}";"${p.categorie || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_petite_caisse_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.info('Export CSV du journal de caisse téléchargé.');
  }
}
