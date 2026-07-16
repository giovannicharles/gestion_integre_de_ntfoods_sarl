import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CommercialService, RecouvrementBE } from '../../../../commercial/infrastructure/commercial.service';

interface RecouvrementUI {
  id: string; clientId: string; clientNom: string;
  montantDette: number; montantEncaisse: number; soldeRestant: number;
  dateEncaissement: Date | null; commercialId: string; statut: string;
}

@Component({
  selector: 'app-comptable-recouvrement',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './comptable-recouvrement.component.html',
  styleUrls: ['./comptable-recouvrement.component.css']
})
export class ComptableRecouvrementComponent implements OnInit {
  private readonly svc = inject(CommercialService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);

  recouvrement = signal<RecouvrementUI[]>([]);

  totalCreances = computed(() => this.recouvrement().reduce((s, r) => s + r.montantDette, 0));
  totalEncaisse = computed(() => this.recouvrement().reduce((s, r) => s + r.montantEncaisse, 0));
  totalSolde = computed(() => this.recouvrement().reduce((s, r) => s + r.soldeRestant, 0));
  nbApures = computed(() => this.recouvrement().filter(r => r.statut === 'APURE').length);

  ngOnInit(): void {
    this.loading.set(true);
    this.svc.getRecouvrements().subscribe({
      next: list => { this.recouvrement.set(list.map(this.mapR)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  rembourser(id: string, montant: number): void {
    this.svc.rembourserRecouvrement(id, montant).subscribe({
      next: r => this.recouvrement.update(list =>
        list.map(rec => rec.id === id ? this.mapR(r) : rec)
      ),
    });
  }

  getCommercialNom(id: string): string { return id; }

  tauxRecouvrement(): number {
    const total = this.totalCreances();
    if (total === 0) return 0;
    return Math.round((this.totalEncaisse() / total) * 100);
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      APURE: 'badge bg-success',
      PARTIEL: 'badge bg-orange',
      EN_ATTENTE: 'badge bg-red',
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
