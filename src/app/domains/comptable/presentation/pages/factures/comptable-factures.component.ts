import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComptableService, FactureBE, LigneFactureBE } from '../../../infrastructure/comptable.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface FactureUI {
  id: string; numero: string; codeClient: string; clientNom: string; type: string;
  dateEmission: Date; dateFacture: Date; statut: string; montantHT: number;
  montantTVA: number; tva: number; montantTTC: number;
}

@Component({
  selector: 'app-comptable-factures',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './comptable-factures.component.html',
  styleUrls: ['./comptable-factures.component.css']
})
export class ComptableFacturesComponent implements OnInit {
  private readonly svc = inject(ComptableService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);
  showForm = signal(false);

  factures = signal<FactureUI[]>([]);

  totalEmis = computed(() =>
    this.factures().filter(f => f.type === 'FACTURE').reduce((s, f) => s + f.montantTTC, 0)
  );
  totalPaye = computed(() =>
    this.factures().filter(f => f.statut === 'PAYEE').reduce((s, f) => s + f.montantTTC, 0)
  );
  totalAvoirs = computed(() =>
    this.factures().filter(f => f.type === 'AVOIR').reduce((s, f) => s + f.montantTTC, 0)
  );
  nbEmises = computed(() => this.factures().filter(f => f.statut === 'EMISE').length);

  formSaving = signal(false);
  formCodeClient = '';
  formTypeFacture = 'FACTURE';
  formLignes = signal<{ referenceArticle: string; designation: string; quantite: number; prixUnitaireHT: number; tauxTVA: number; remise: number }[]>([
    { referenceArticle: '', designation: '', quantite: 1, prixUnitaireHT: 0, tauxTVA: 19.25, remise: 0 },
  ]);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  ngOnInit(): void {
    const now = new Date();
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    this.loading.set(true);
    this.svc.getFactures(this.fmtDate(debut), this.fmtDate(now)).subscribe({
      next: page => { this.factures.set(page.contenu.map(this.mapF)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  ajouterLigne(): void {
    this.formLignes.update(l => [...l, { referenceArticle: '', designation: '', quantite: 1, prixUnitaireHT: 0, tauxTVA: 19.25, remise: 0 }]);
  }
  supprimerLigne(i: number): void {
    this.formLignes.update(l => l.filter((_, idx) => idx !== i));
  }
  get formTotalHT() { return this.formLignes().reduce((s, l) => s + (l.quantite * l.prixUnitaireHT * (1 - l.remise / 100)), 0); }
  get formTotalTVA() { return this.formLignes().reduce((s, l) => s + (l.quantite * l.prixUnitaireHT * (1 - l.remise / 100) * l.tauxTVA / 100), 0); }
  get formTotalTTC() { return this.formTotalHT + this.formTotalTVA; }

  emettreFacture(): void {
    if (this.formSaving() || !this.formCodeClient || this.formLignes().some(l => !l.referenceArticle || !l.designation)) return;
    this.formSaving.set(true);
    this.svc.emettreFacture({
      codeClient: this.formCodeClient,
      typeFacture: this.formTypeFacture,
      matriculeEmetteur: 'CURRENT_USER',
      lignes: this.formLignes(),
    }).subscribe({
      next: f => {
        this.factures.update(list => [this.mapF(f), ...list]);
        this.formSaving.set(false);
        this.showForm.set(false);
        this.formCodeClient = '';
        this.formLignes.set([{ referenceArticle: '', designation: '', quantite: 1, prixUnitaireHT: 0, tauxTVA: 19.25, remise: 0 }]);
        this.showToast('Facture émise avec succès.', 'success');
      },
      error: (e) => {
        this.formSaving.set(false);
        this.showToast(extractApiError(e), 'error');
      },
    });
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  payer(numero: string): void {
    this.svc.payerFacture(numero).subscribe({
      next: f => this.factures.update(list =>
        list.map(fac => fac.numero === numero ? this.mapF(f) : fac)
      ),
    });
  }

  annuler(numero: string): void {
    this.svc.annulerFacture(numero).subscribe({
      next: f => this.factures.update(list =>
        list.map(fac => fac.numero === numero ? this.mapF(f) : fac)
      ),
    });
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      EMISE: 'badge bg-orange', PAYEE: 'badge bg-success', ANNULEE: 'badge bg-red',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  typeClass(t: string): string {
    return t === 'AVOIR' ? 'badge bg-red' : 'badge bg-neutral';
  }

  private mapF(f: FactureBE): FactureUI {
    const d = new Date(f.dateEmission);
    return {
      id: String(f.id),
      numero: f.numeroFacture,
      codeClient: f.codeClient,
      clientNom: f.codeClient,
      type: f.typeFacture,
      dateEmission: d,
      dateFacture: d,
      statut: f.statut,
      montantHT: f.montantTotalHT,
      montantTVA: f.montantTotalTVA,
      tva: f.montantTotalTVA,
      montantTTC: f.montantTotalTTC,
    };
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
