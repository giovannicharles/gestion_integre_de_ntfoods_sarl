import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, RecouvrementBE } from '../../../infrastructure/commercial.service';

interface RecouvrementUI {
  id: string; clientId: string; clientNom: string;
  montantDette: number; montantEncaisse: number; soldeRestant: number;
  dateEcheance: Date | null; commercialId: string; statut: string;
}

@Component({
  selector: 'app-commercial-recouvrement',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './commercial-recouvrement.component.html',
  styleUrls: ['./commercial-recouvrement.component.css']
})
export class CommercialRecouvrementComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);

  today = new Date();
  recouvrement = signal<RecouvrementUI[]>([]);
  loading = signal(false);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  totalDettes = computed(() => this.recouvrement().reduce((s, r) => s + r.montantDette, 0));
  totalEncaisse = computed(() => this.recouvrement().reduce((s, r) => s + r.montantEncaisse, 0));
  nbApures = computed(() => this.recouvrement().filter(r => r.statut === 'APURE').length);
  nbEnCours = computed(() => this.recouvrement().filter(r => r.statut === 'PARTIEL' || r.statut === 'EN_ATTENTE').length);
  clientsDebiteurs = computed(() => new Set(this.recouvrement().map(r => r.clientId)).size);

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
    return this.recouvrement().find(r => r.clientId === clientId)?.statut ?? '—';
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
