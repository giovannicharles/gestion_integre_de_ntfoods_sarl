import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ComptableService, VersementBE } from '../../../../../domains/comptable/infrastructure/comptable.service';

interface VersementUI {
  id: string; commercialId: string; date: Date;
  montantAttendu: number; cashVerse: number; ecart: number;
  motifEcart: string | null; statut: string;
  typeVersement: string | null; alerteRouge: boolean;
  heureVersement: string | null;
}

@Component({
  selector: 'app-secretaire-versements',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './secretaire-versements.component.html',
  styleUrls: ['./secretaire-versements.component.css']
})
export class SecretaireVersementsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(ComptableService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);

  versements = signal<VersementUI[]>([]);
  typesVersement = ['ESPECES', 'CHEQUE', 'VIREMENT'];
  montantSaisis: Record<string, number> = {};
  typesSaisis: Record<string, string> = {};
  motifsSaisis: Record<string, string> = {};

  alertes = computed(() => this.versements().filter(v => v.alerteRouge));
  totalVerse = computed(() => this.versements().reduce((s, v) => s + v.cashVerse, 0));
  nbValides = computed(() => this.versements().filter(v => v.statut === 'VALIDE').length);

  ngOnInit(): void {
    const today = this.fmtDate(new Date());
    this.loading.set(true);
    this.svc.getVersements({ date: today }).subscribe({
      next: list => { this.versements.set(list.map(this.mapV)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  valider(id: string): void {
    const verse = this.montantSaisis[id] ?? 0;
    const type = this.typesSaisis[id] ?? 'ESPECES';
    const matricule = this.auth.user()?.matricule ?? '';
    this.svc.enregistrerVersement({
      matriculeCommercial: id,
      montantAttendu: verse,
      cashVerse: verse,
      typeVersement: type,
    }).subscribe({
      next: v => {
        this.versements.update(list =>
          list.map(ver => ver.id === id
            ? { ...ver, cashVerse: verse, typeVersement: type, statut: 'EN_ATTENTE_VALIDATION' }
            : ver
          )
        );
      },
    });
  }

  getCommercialNom(id: string): string { return id; }

  ecartCalc(attendu: number, verse: number): number { return verse - attendu; }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      VALIDE: 'badge bg-success',
      EN_ATTENTE: 'badge bg-neutral',
      EN_ATTENTE_VALIDATION: 'badge bg-orange',
      ECART_JUSTIFIE: 'badge bg-orange',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  private mapV(v: VersementBE): VersementUI {
    const d = new Date(v.date);
    return {
      id: v.referenceVersement,
      commercialId: v.matriculeCommercial,
      date: d,
      montantAttendu: v.montantAttendu,
      cashVerse: v.cashVerse,
      ecart: v.ecart,
      motifEcart: v.justificationEcart ?? null,
      statut: v.statut,
      typeVersement: v.typeVersement ?? null,
      alerteRouge: v.alerteRouge,
      heureVersement: d.toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
