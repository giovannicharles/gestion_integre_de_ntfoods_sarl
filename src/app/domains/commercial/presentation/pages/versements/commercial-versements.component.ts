import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ComptableService, VersementBE } from '../../../../comptable/infrastructure/comptable.service';
import { ToastService } from '../../../../../core/services/toast.service';

interface VersementUI {
  id: string; commercialId: string; date: Date; montantAttendu: number;
  cashVerse: number; ecart: number; motifEcart: string | null;
  statut: string; typeVersement: string | null; alerteRouge: boolean;
  heureVersement: string | null;
}

@Component({
  selector: 'app-commercial-versements',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './commercial-versements.component.html',
  styleUrls: ['./commercial-versements.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialVersementsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(ComptableService);
  private readonly toast = inject(ToastService);

  today = new Date();
  versements = signal<VersementUI[]>([]);
  loading = signal(false);
  montantVerse = signal(0);
  typeVersement = signal<'ESPECES' | 'CHEQUE' | 'VIREMENT'>('ESPECES');
  motif = signal('');
  submitted = signal(false);
  showForm = signal(false);
  showQuittanceModal = signal(false);
  selectedVersement = signal<VersementUI | null>(null);

  monVersement = computed(() => this.versements()[0] ?? null);
  totalVerse = computed(() => this.versements().reduce((sum, v) => sum + v.cashVerse, 0));
  nbValides = computed(() => this.versements().filter(v => v.statut === 'VALIDE').length);
  nbAttente = computed(() => this.versements().filter(v => v.statut !== 'VALIDE' && v.statut !== 'REJETE').length);
  nbEcarts = computed(() => this.versements().filter(v => v.ecart !== 0 || v.alerteRouge).length);

  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  imprimerQuittance(v: VersementUI): void {
    this.selectedVersement.set(v);
    this.showQuittanceModal.set(true);
  }

  fermerQuittance(): void {
    this.showQuittanceModal.set(false);
    this.selectedVersement.set(null);
  }

  lancerImpression(): void {
    window.print();
  }

  exporterCsv(): void {
    const list = this.versements();
    if (!list.length) {
      this.toast.info('Aucun versement à exporter.');
      return;
    }
    const headers = ['Reference', 'Commercial', 'Date', 'Type Versement', 'Montant Attendu', 'Cash Verse', 'Ecart', 'Statut'];
    const rows = list.map(v => [
      `"${v.id}"`,
      `"${v.commercialId}"`,
      `"${v.date ? new Date(v.date).toLocaleDateString('fr-FR') : ''}"`,
      `"${v.typeVersement || 'ESPECES'}"`,
      v.montantAttendu,
      v.cashVerse,
      v.ecart,
      `"${v.statut}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `versements_caisse_tanty_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.toast.success(`${list.length} versement(s) exporté(s) en CSV.`);
  }

  ngOnInit(): void {
    const matricule = this.auth.user()?.matricule;
    if (!matricule) return;
    this.loading.set(true);
    this.svc.getVersements({ commercial: matricule }).subscribe({
      next: list => { this.versements.set(list.map(this.mapV)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    if (this.montantVerse() <= 0) return;
    const matricule = this.auth.user()?.matricule ?? '';
    this.svc.enregistrerVersement({
      matriculeCommercial: matricule,
      montantAttendu: this.montantVerse(),
      cashVerse: this.montantVerse(),
      typeVersement: this.typeVersement(),
    }).subscribe({
      next: v => {
        this.versements.update(list => [this.mapV(v), ...list]);
        this.submitted.set(true);
        this.showForm.set(false);
        this.montantVerse.set(0);
        this.motif.set('');
      },
      error: () => this.toast.error('Impossible d\'enregistrer le versement'),
    });
  }

  private mapV(v: VersementBE): VersementUI {
    const dateV = new Date(v.date);
    return {
      id: v.referenceVersement,
      commercialId: v.matriculeCommercial,
      date: dateV,
      montantAttendu: v.montantAttendu,
      cashVerse: v.cashVerse,
      ecart: v.ecart,
      motifEcart: v.justificationEcart ?? null,
      statut: v.statut,
      typeVersement: v.typeVersement ?? null,
      alerteRouge: v.alerteRouge,
      heureVersement: dateV.toISOString() !== 'Invalid Date'
        ? dateV.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : null,
    };
  }
}
