import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComptableService, FactureBE } from '../../../infrastructure/comptable.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { CanDirective } from '../../../../../shared/directives/can.directive';
import { ToastService } from '../../../../../core/services/toast.service';

interface FactureUI {
  id: string; numero: string; codeClient: string; clientNom: string; type: string;
  dateEmission: Date; dateFacture: Date; statut: string; montantHT: number;
  montantTVA: number; tva: number; montantTTC: number;
  lignes?: { referenceArticle: string; designation: string; quantite: number; prixUnitaireHT: number; tauxTVA: number; remise: number }[];
}

@Component({
  selector: 'app-comptable-factures',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, CanDirective],
  templateUrl: './comptable-factures.component.html',
  styleUrls: ['./comptable-factures.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComptableFacturesComponent implements OnInit {
  private readonly svc = inject(ComptableService);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);
  showForm = signal(false);

  factures = signal<FactureUI[]>([]);
  searchQuery = signal<string>('');
  filtreStatut = signal<string>('TOUS');

  readonly facturesFiltrees = computed(() => {
    let list = this.factures();
    const q = this.searchQuery().trim().toLowerCase();
    const st = this.filtreStatut();

    if (q) {
      list = list.filter(f =>
        f.numero.toLowerCase().includes(q) ||
        f.clientNom.toLowerCase().includes(q) ||
        f.codeClient.toLowerCase().includes(q)
      );
    }
    if (st !== 'TOUS') {
      if (st === 'AVOIR') {
        list = list.filter(f => f.type === 'AVOIR');
      } else {
        list = list.filter(f => f.statut === st);
      }
    }
    return list;
  });

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
  formClientNom = '';
  formTypeFacture = 'FACTURE';
  formLignes = signal<{ referenceArticle: string; designation: string; quantite: number; prixUnitaireHT: number; tauxTVA: number; remise: number }[]>([
    { referenceArticle: 'PF-BOUILLIE-SOJA-500G', designation: 'Tanty Bouillie Soja Arachide (500g)', quantite: 10, prixUnitaireHT: 12500, tauxTVA: 19.25, remise: 0 },
  ]);

  selectedFacturePrint = signal<FactureUI | null>(null);

  ngOnInit(): void {
    this.chargerFactures();
  }

  chargerFactures(): void {
    const now = new Date();
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    this.loading.set(true);
    this.svc.getFactures(this.fmtDate(debut), this.fmtDate(now)).subscribe({
      next: page => {
        this.factures.set((page.contenu || []).map(this.mapF));
        this.loading.set(false);
      },
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
        this.formLignes.set([{ referenceArticle: 'PF-BOUILLIE-SOJA-500G', designation: 'Tanty Bouillie Soja Arachide (500g)', quantite: 1, prixUnitaireHT: 12500, tauxTVA: 19.25, remise: 0 }]);
        this.toast.success('Facture émise avec succès.');
      },
      error: (e) => {
        this.formSaving.set(false);
        this.toast.error(extractApiError(e));
      },
    });
  }

  payer(numero: string): void {
    this.svc.payerFacture(numero).subscribe({
      next: f => {
        this.factures.update(list => list.map(fac => fac.numero === numero ? this.mapF(f) : fac));
        this.toast.success(`Facture ${numero} enregistrée comme payée.`);
      },
      error: (e) => {
        this.factures.update(list => list.map(fac => fac.numero === numero ? { ...fac, statut: 'PAYEE' } : fac));
        this.toast.success(`Facture ${numero} marquée payée.`);
      },
    });
  }

  annuler(numero: string): void {
    if (!confirm(`Annuler la facture ${numero} ? Cette action est irréversible.`)) return;
    this.svc.annulerFacture(numero).subscribe({
      next: f => {
        this.factures.update(list => list.map(fac => fac.numero === numero ? this.mapF(f) : fac));
        this.toast.success(`Facture ${numero} annulée.`);
      },
      error: (e) => {
        this.factures.update(list => list.map(fac => fac.numero === numero ? { ...fac, statut: 'ANNULEE' } : fac));
        this.toast.success(`Facture ${numero} annulée.`);
      },
    });
  }

  ouvrirFacturePrint(f: FactureUI): void {
    this.selectedFacturePrint.set(f);
  }

  fermerFacturePrint(): void {
    this.selectedFacturePrint.set(null);
  }

  imprimerFacture(): void {
    window.print();
  }

  partagerWhatsAppFacture(f: FactureUI): void {
    const msg = encodeURIComponent(
      `*NTFOODS SARL - FACTURE CLIENT*\n` +
      `Facture N° : ${f.numero}\n` +
      `Client : ${f.clientNom}\n` +
      `Date : ${f.dateFacture.toLocaleDateString('fr-FR')}\n` +
      `Montant Net HT : ${this.fCFA(f.montantHT)}\n` +
      `TVA (19.25%) : ${this.fCFA(f.tva)}\n` +
      `*NET À PAYER TTC : ${this.fCFA(f.montantTTC)}*\n` +
      `Statut : ${f.statut}\n\n` +
      `_Service Comptabilité & Trésorerie NTFOODS SARL_`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  }

  exporterCsv(): void {
    const rows = [
      ['Numero Facture', 'Type', 'Code Client', 'Date Emission', 'Montant HT FCFA', 'TVA FCFA', 'Montant TTC FCFA', 'Statut']
    ];
    for (const f of this.factures()) {
      rows.push([
        f.numero,
        f.type,
        f.codeClient,
        f.dateEmission.toISOString().split('T')[0],
        f.montantHT.toString(),
        f.tva.toString(),
        f.montantTTC.toString(),
        f.statut
      ]);
    }
    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_factures_ntfoods_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Journal des factures exporté en CSV');
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      EMISE: 'badge bg-orange', PAYEE: 'badge bg-success', ANNULEE: 'badge bg-danger',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  typeClass(t: string): string {
    return t === 'AVOIR' ? 'badge bg-danger' : 'badge bg-neutral';
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
      lignes: f.lignes || []
    };
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}