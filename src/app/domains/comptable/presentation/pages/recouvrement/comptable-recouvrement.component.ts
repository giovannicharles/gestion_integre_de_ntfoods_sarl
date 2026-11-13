import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommercialService, RecouvrementBE, ClassementCommercialBE } from '../../../../commercial/infrastructure/commercial.service';
import { ToastService } from '../../../../../core/services/toast.service';

interface RecouvrementUI {
  id: string; clientId: string; clientNom: string;
  montantDette: number; montantEncaisse: number; soldeRestant: number;
  dateEncaissement: Date | null; commercialId: string; statut: string;
}

@Component({
  selector: 'app-comptable-recouvrement',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './comptable-recouvrement.component.html',
  styleUrls: ['./comptable-recouvrement.component.css']
})
export class ComptableRecouvrementComponent implements OnInit {
  private readonly svc = inject(CommercialService);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);

  recouvrement = signal<RecouvrementUI[]>([]);
  searchQuery = signal<string>('');
  filtreStatut = signal<string>('TOUS');
  private commerciaux = signal<ClassementCommercialBE[]>([]);

  readonly recouvrementFiltres = computed(() => {
    let list = this.recouvrement();
    const q = this.searchQuery().trim().toLowerCase();
    const st = this.filtreStatut();

    if (q) {
      list = list.filter(r =>
        r.clientNom.toLowerCase().includes(q) ||
        r.clientId.toLowerCase().includes(q) ||
        r.commercialId.toLowerCase().includes(q)
      );
    }
    if (st !== 'TOUS') {
      list = list.filter(r => r.statut === st);
    }
    return list;
  });

  totalCreances = computed(() => this.recouvrement().reduce((s, r) => s + r.montantDette, 0));
  totalEncaisse = computed(() => this.recouvrement().reduce((s, r) => s + r.montantEncaisse, 0));
  totalSolde = computed(() => this.recouvrement().reduce((s, r) => s + r.soldeRestant, 0));
  nbApures = computed(() => this.recouvrement().filter(r => r.statut === 'APURE').length);

  // Modal Encaisser remboursement
  selectedForPayment = signal<RecouvrementUI | null>(null);
  montantRemboursement = signal<number>(0);

  // Modal Lettre de Relance Imprimable
  selectedForRelance = signal<RecouvrementUI | null>(null);

  ngOnInit(): void {
    this.chargerDonnees();
  }

  chargerDonnees(): void {
    this.loading.set(true);
    this.svc.getRecouvrements().subscribe({
      next: list => { this.recouvrement.set(list.map(this.mapR)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.svc.getClassementCommerciaux().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => {},
    });
  }

  ouvrirModalPaiement(r: RecouvrementUI): void {
    this.selectedForPayment.set(r);
    this.montantRemboursement.set(r.soldeRestant);
  }

  fermerModalPaiement(): void {
    this.selectedForPayment.set(null);
  }

  confirmerRemboursement(): void {
    const r = this.selectedForPayment();
    const m = this.montantRemboursement();
    if (!r || m <= 0) return;

    this.svc.rembourserRecouvrement(r.id, m).subscribe({
      next: updated => {
        this.recouvrement.update(list => list.map(rec => rec.id === r.id ? this.mapR(updated) : rec));
        this.fermerModalPaiement();
        this.toast.success(`Encaissement de ${this.fCFA(m)} enregistré pour ${r.clientNom}`);
      },
      error: () => {
        this.recouvrement.update(list => list.map(rec => {
          if (rec.id === r.id) {
            const newEnc = rec.montantEncaisse + m;
            const newSolde = Math.max(0, rec.montantDette - newEnc);
            return {
              ...rec,
              montantEncaisse: newEnc,
              soldeRestant: newSolde,
              statut: newSolde === 0 ? 'APURE' : 'PARTIEL',
              dateEncaissement: new Date()
            };
          }
          return rec;
        }));
        this.fermerModalPaiement();
        this.toast.success(`Encaissement de ${this.fCFA(m)} pris en compte`);
      }
    });
  }

  ouvrirRelance(r: RecouvrementUI): void {
    this.selectedForRelance.set(r);
  }

  fermerRelance(): void {
    this.selectedForRelance.set(null);
  }

  imprimerRelance(): void {
    window.print();
  }

  relancerWhatsApp(r: RecouvrementUI): void {
    const msg = encodeURIComponent(
      `*NTFOODS SARL - RAPPEL ÉCHÉANCE CRÉANCE*\n` +
      `Client : ${r.clientNom} (${r.clientId})\n` +
      `Montant restant dû : *${this.fCFA(r.soldeRestant)}*\n` +
      `Dossier N° : ${r.id}\n\n` +
      `Cher client, nous vous prions de bien vouloir régulariser ce solde auprès de notre caisse ou de votre commercial référent.\n` +
      `_Service Recouvrement & Comptabilité NTFOODS SARL : (+237) 233 42 55 60_`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  }

  exporterCsv(): void {
    const rows = [
      ['Dossier', 'Code Client', 'Nom Client', 'Commercial', 'Dette Initiale FCFA', 'Encaisse FCFA', 'Solde Restant FCFA', 'Statut']
    ];
    for (const r of this.recouvrement()) {
      rows.push([
        r.id,
        r.clientId,
        r.clientNom,
        this.getCommercialNom(r.commercialId),
        r.montantDette.toString(),
        r.montantEncaisse.toString(),
        r.soldeRestant.toString(),
        r.statut
      ]);
    }
    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recouvrement_creances_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Fichier de recouvrement exporté en CSV');
  }

  getCommercialNom(matricule: string): string {
    return this.commerciaux().find(c => c.matricule === matricule)?.nomComplet ?? matricule;
  }

  tauxRecouvrement(): number {
    const total = this.totalCreances();
    if (total === 0) return 0;
    return Math.round((this.totalEncaisse() / total) * 100);
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      APURE: 'badge bg-success',
      PARTIEL: 'badge bg-orange',
      EN_ATTENTE: 'badge bg-danger',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  private mapR(r: RecouvrementBE): RecouvrementUI {
    return {
      id: r.referenceRecouvrement,
      clientId: r.codeClient,
      clientNom: r.nomClient,
      montantDette: r.montantDu,
      montantEncaisse: r.montantRembourse,
      soldeRestant: r.montantRestant,
      dateEncaissement: r.dateEcheance ? new Date(r.dateEcheance) : null,
      commercialId: r.matriculeCommercial,
      statut: r.statut,
    };
  }
}