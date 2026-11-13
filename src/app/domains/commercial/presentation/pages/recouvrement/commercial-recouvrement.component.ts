import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, RecouvrementBE } from '../../../infrastructure/commercial.service';
import { ToastService } from '../../../../../core/services/toast.service';

interface RecouvrementUI {
  id: string; clientId: string; clientNom: string;
  montantDette: number; montantEncaisse: number; soldeRestant: number;
  dateEcheance: Date | null; commercialId: string; statut: string;
}

@Component({
  selector: 'app-commercial-recouvrement',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './commercial-recouvrement.component.html',
  styleUrls: ['./commercial-recouvrement.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialRecouvrementComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);
  private readonly toast = inject(ToastService);

  today = new Date();
  recouvrement = signal<RecouvrementUI[]>([]);
  filtreStatut = signal<'TOUS' | 'EN_COURS' | 'APURE'>('TOUS');
  filtreTexte = signal<string>('');
  loading = signal(false);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  totalDettes = computed(() => this.recouvrement().reduce((s, r) => s + r.montantDette, 0));
  totalEncaisse = computed(() => this.recouvrement().reduce((s, r) => s + r.montantEncaisse, 0));
  totalSoldeRestant = computed(() => this.recouvrement().reduce((s, r) => s + r.soldeRestant, 0));
  nbApures = computed(() => this.recouvrement().filter(r => r.statut === 'APURE').length);
  nbEnCours = computed(() => this.recouvrement().filter(r => r.statut === 'PARTIEL' || r.statut === 'EN_ATTENTE').length);
  clientsDebiteurs = computed(() => new Set(this.recouvrement().filter(r => r.soldeRestant > 0).map(r => r.clientId)).size);

  recouvrementsFiltres = computed(() => {
    const st = this.filtreStatut();
    const t = this.filtreTexte().trim().toLowerCase();

    return this.recouvrement().filter(r => {
      let matchStatut = true;
      if (st === 'EN_COURS') matchStatut = r.statut === 'PARTIEL' || r.statut === 'EN_ATTENTE';
      else if (st === 'APURE') matchStatut = r.statut === 'APURE';

      const matchText = !t ||
        r.clientNom.toLowerCase().includes(t) ||
        r.clientId.toLowerCase().includes(t) ||
        r.id.toLowerCase().includes(t);

      return matchStatut && matchText;
    });
  });

  setFiltreStatut(st: 'TOUS' | 'EN_COURS' | 'APURE'): void {
    if (this.filtreStatut() === st && st !== 'TOUS') {
      this.filtreStatut.set('TOUS');
    } else {
      this.filtreStatut.set(st);
    }
  }

  charger(): void {
    const matricule = this.auth.user()?.matricule;
    if (!matricule) return;
    this.loading.set(true);
    this.svc.getRecouvrements({ commercial: matricule }).subscribe({
      next: list => { this.recouvrement.set(list.map(this.mapR)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  exporterCsv(): void {
    const list = this.recouvrementsFiltres();
    if (!list.length) {
      this.toast.info('Aucune créance à exporter.');
      return;
    }
    const headers = ['Reference', 'Code Client', 'Nom Client', 'Creance Initiale (FCFA)', 'Encaisse (FCFA)', 'Solde Restant (FCFA)', 'Echeance', 'Statut'];
    const rows = list.map(r => [
      `"${r.id}"`,
      `"${r.clientId}"`,
      `"${r.clientNom.replace(/"/g, '""')}"`,
      r.montantDette,
      r.montantEncaisse,
      r.soldeRestant,
      r.dateEcheance ? new Date(r.dateEcheance).toLocaleDateString('fr-FR') : '',
      `"${r.statut}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `recouvrements_tanty_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.toast.success(`${list.length} créance(s) exportée(s) en CSV.`);
  }

  ngOnInit(): void {
    const matricule = this.auth.user()?.matricule;
    if (!matricule) return;
    this.loading.set(true);
    this.svc.getRecouvrements({ commercial: matricule }).subscribe({
      next: list => { this.recouvrement.set(list.map(this.mapR)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  getClientType(clientId: string): string {
    return this.recouvrement().find(r => r.clientId === clientId)?.statut ?? '-';
  }

  private mapR(r: RecouvrementBE): RecouvrementUI {
    return {
      id: r.referenceRecouvrement,
      clientId: r.codeClient,
      clientNom: r.nomClient,
      montantDette: r.montantDu,
      montantEncaisse: r.montantRembourse,
      soldeRestant: r.montantRestant,
      dateEcheance: r.dateEcheance ? new Date(r.dateEcheance) : null,
      commercialId: r.matriculeCommercial,
      statut: r.statut,
    };
  }
}
