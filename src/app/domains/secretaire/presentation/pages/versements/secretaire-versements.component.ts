import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ComptableService, VersementBE } from '../../../../../domains/comptable/infrastructure/comptable.service';
import { CommercialService, ClassementCommercialBE } from '../../../../../domains/commercial/infrastructure/commercial.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { CanDirective } from '../../../../../shared/directives/can.directive';

export interface VersementUI {
  id: string;
  commercialId: string;
  commercialNom?: string;
  date: Date;
  montantAttendu: number;
  cashVerse: number;
  ecart: number;
  motifEcart: string | null;
  statut: string;
  typeVersement: string | null;
  alerteRouge: boolean;
  heureVersement: string | null;
}

@Component({
  selector: 'app-secretaire-versements',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, CanDirective],
  templateUrl: './secretaire-versements.component.html',
  styleUrls: ['./secretaire-versements.component.css']
})
export class SecretaireVersementsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(ComptableService);
  private readonly commercialSvc = inject(CommercialService);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);

  versements = signal<VersementUI[]>([]);
  typesVersement = ['ESPECES', 'CHEQUE', 'VIREMENT', 'ORANGE_MONEY', 'MTN_MOMO'];
  montantSaisis: Record<string, number> = {};
  typesSaisis: Record<string, string> = {};
  motifsSaisis: Record<string, string> = {};

  searchQuery = signal<string>('');
  filtreStatut = signal<'TOUS' | 'EN_ATTENTE' | 'VALIDE' | 'ALERTE_ROUGE'>('TOUS');

  // Modal d'impression officielle quittance
  versementAImprimer = signal<VersementUI | null>(null);

  readonly versementsFiltres = computed(() => {
    let list = this.versements();
    const q = this.searchQuery().trim().toLowerCase();
    const st = this.filtreStatut();

    if (q) {
      list = list.filter(v =>
        v.id.toLowerCase().includes(q) ||
        (v.commercialNom && v.commercialNom.toLowerCase().includes(q)) ||
        v.commercialId.toLowerCase().includes(q)
      );
    }
    if (st !== 'TOUS') {
      if (st === 'ALERTE_ROUGE') {
        list = list.filter(v => v.alerteRouge);
      } else {
        list = list.filter(v => v.statut === st);
      }
    }
    return list;
  });

  alertes = computed(() => this.versements().filter(v => v.alerteRouge));
  totalVerse = computed(() => this.versements().reduce((s, v) => s + v.cashVerse, 0));
  totalAttendu = computed(() => this.versements().reduce((s, v) => s + v.montantAttendu, 0));
  nbValides = computed(() => this.versements().filter(v => v.statut === 'VALIDE').length);
  nbEnAttente = computed(() => this.versements().filter(v => v.statut === 'EN_ATTENTE').length);

  private commerciaux = signal<ClassementCommercialBE[]>([]);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    const today = this.fmtDate(new Date());
    this.loading.set(true);
    this.svc.getVersements({ date: today }).subscribe({
      next: list => {
        this.versements.set(list.map(v => this.mapV(v)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.commercialSvc.getClassementCommerciaux().subscribe({
      next: c => {
        this.commerciaux.set(c);
        this.versements.update(list =>
          list.map(v => ({
            ...v,
            commercialNom: this.getCommercialNom(v.commercialId)
          }))
        );
      },
      error: () => {},
    });
  }

  valider(id: string): void {
    const verse = this.montantSaisis[id] ?? 0;
    const type = this.typesSaisis[id] ?? 'ESPECES';
    const motif = this.motifsSaisis[id] ?? '';

    if (verse <= 0) {
      this.toast.error('Veuillez saisir un montant versé valide supérieur à 0.', 'Montant incorrect');
      return;
    }

    this.svc.enregistrerVersement({
      matriculeCommercial: id,
      montantAttendu: verse,
      cashVerse: verse,
      typeVersement: type,
    }).subscribe({
      next: v => {
        const mapped = this.mapV(v);
        this.versements.update(list => list.map(ver => ver.id === id ? mapped : ver));
        this.toast.success(`Versement ${id} enregistré avec succès.`);
      },
      error: (err) => this.toast.error(extractApiError(err), 'Versement non enregistré'),
    });
  }

  getCommercialNom(matricule: string): string {
    return this.commerciaux().find(c => c.matricule === matricule)?.nomComplet ?? matricule;
  }

  ecartCalc(attendu: number, verse: number): number {
    return verse - attendu;
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      VALIDE: 'badge bg-success',
      EN_ATTENTE: 'badge bg-orange',
      ALERTE_ROUGE: 'badge bg-red',
      JUSTIFIE: 'badge bg-gold',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  imprimerQuittance(v: VersementUI): void {
    this.versementAImprimer.set(v);
  }

  fermerImpression(): void {
    this.versementAImprimer.set(null);
  }

  lancerImpression(): void {
    window.print();
  }

  exporterCsv(): void {
    const list = this.versementsFiltres();
    let csv = 'Reference;Commercial;Montant_Attendu;Montant_Verse;Ecart;Statut;Type;Date_Heure\n';
    list.forEach(v => {
      csv += `"${v.id}";"${v.commercialNom || v.commercialId}";"${v.montantAttendu}";"${v.cashVerse}";"${v.ecart}";"${v.statut}";"${v.typeVersement || ''}";"${new Date(v.date).toLocaleDateString()} ${v.heureVersement || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `versements_caisse_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.info('Export CSV des versements téléchargé.');
  }

  private mapV(v: VersementBE): VersementUI {
    const d = new Date(v.date);
    return {
      id: v.referenceVersement,
      commercialId: v.matriculeCommercial,
      commercialNom: this.getCommercialNom(v.matriculeCommercial),
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
