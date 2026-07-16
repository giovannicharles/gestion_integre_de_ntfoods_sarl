import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ComptableService, VersementBE } from '../../../../comptable/infrastructure/comptable.service';

interface VersementUI {
  id: string; commercialId: string; date: Date; montantAttendu: number;
  cashVerse: number; ecart: number; motifEcart: string | null;
  statut: string; typeVersement: string | null; alerteRouge: boolean;
  heureVersement?: string;
}

@Component({
  selector: 'app-commercial-versements',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './commercial-versements.component.html',
  styleUrls: ['./commercial-versements.component.css']
})
export class CommercialVersementsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(ComptableService);

  today = new Date();
  versements = signal<VersementUI[]>([]);
  loading = signal(false);
  montantVerse = signal(0);
  typeVersement = signal<'ESPECES' | 'CHEQUE' | 'VIREMENT'>('ESPECES');
  motif = signal('');
  submitted = signal(false);
  showForm = signal(false);

  monVersement = computed(() => this.versements()[0] ?? null);

  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

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
    });
  }

  private mapV(v: VersementBE): VersementUI {
    return {
      id: v.referenceVersement,
      commercialId: v.matriculeCommercial,
      date: new Date(v.date),
      montantAttendu: v.montantAttendu,
      cashVerse: v.cashVerse,
      ecart: v.ecart,
      motifEcart: v.justificationEcart ?? null,
      statut: v.statut,
      typeVersement: v.typeVersement ?? null,
      alerteRouge: v.alerteRouge,
      heureVersement: new Date(v.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
  }
}
