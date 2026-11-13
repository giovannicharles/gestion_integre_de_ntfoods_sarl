import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, VenteBE, AvoirBE } from '../../../infrastructure/commercial.service';
import { DocumentService } from '../../../../shared/infrastructure/document.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-commercial-ventes',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, HasPermissionDirective],
  templateUrl: './commercial-ventes.component.html',
  styleUrls: ['./commercial-ventes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialVentesComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private svc = inject(CommercialService);
  private auth = inject(AuthService);
  private docSvc = inject(DocumentService);

  loading = signal(true);
  ventes = signal<VenteBE[]>([]);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  today = new Date();
  filtreStatut = signal<'TOUS' | 'EN_COURS' | 'FINALISEE' | 'ANNULEE'>('TOUS');
  filtreTypeVente = signal<string>('TOUS');
  filtreTexte = signal<string>('');

  showAnnuler = signal(false);
  showNonMarchand = signal(false);
  showAvoir = signal(false);
  showTicketModal = signal(false);
  selectedVenteDetail = signal<VenteBE | null>(null);

  selectedNumero = '';
  annulerMotif = '';
  saving = signal(false);

  nmTypeVente = 'DON';
  nmCodeClient = '';
  nmCodeProduit = '';
  nmDesignation = '';
  nmConditionnement = 'CARTON';
  nmQuantite = 1;
  nmMotif = '';

  /** Seuil réel (unités de base) au-delà duquel une photo est exigée pour une avarie, jamais codé en dur, lu au serveur. */
  seuilPhotoAvarie = signal<number | null>(null);
  nmPhotoFile: File | null = null;
  nmPhotoDocId: number | null = null;
  uploadingPhoto = signal(false);

  avoirMotif = '';
  avoirs = signal<AvoirBE[]>([]);

  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  totalCA = computed(() => this.ventes().filter(v => v.statut === 'FINALISEE').reduce((sum, v) => sum + (v.montantTotal || 0), 0));
  nbFinalisees = computed(() => this.ventes().filter(v => v.statut === 'FINALISEE').length);
  nbEnCours = computed(() => this.ventes().filter(v => v.statut === 'EN_COURS').length);
  nbAnnulees = computed(() => this.ventes().filter(v => v.statut === 'ANNULEE').length);

  ventesFiltrees = computed(() => {
    const st = this.filtreStatut();
    const tp = this.filtreTypeVente();
    const t = this.filtreTexte().trim().toLowerCase();

    return this.ventes().filter(v => {
      const matchStatut = st === 'TOUS' || v.statut === st;
      const matchType = tp === 'TOUS' || v.typeVente === tp;
      const matchText = !t ||
        (v.numeroVente || '').toLowerCase().includes(t) ||
        (v.codeClient || '').toLowerCase().includes(t) ||
        (v.matriculeCommercial || '').toLowerCase().includes(t);
      return matchStatut && matchType && matchText;
    });
  });

  setFiltreStatut(st: 'TOUS' | 'EN_COURS' | 'FINALISEE' | 'ANNULEE'): void {
    if (this.filtreStatut() === st && st !== 'TOUS') {
      this.filtreStatut.set('TOUS');
    } else {
      this.filtreStatut.set(st);
    }
  }

  imprimerBordereau(v: VenteBE): void {
    this.selectedVenteDetail.set(v);
    this.showTicketModal.set(true);
  }

  fermerBordereau(): void {
    this.showTicketModal.set(false);
    this.selectedVenteDetail.set(null);
  }

  lancerImpression(): void {
    window.print();
  }

  exporterCsv(): void {
    const list = this.ventesFiltrees();
    if (!list.length) {
      this.showToast('Aucune vente à exporter.', 'error');
      return;
    }
    const headers = ['Numero Vente', 'Date', 'Code Client', 'Commercial', 'Type Vente', 'Montant Total (FCFA)', 'Statut'];
    const rows = list.map(v => [
      `"${v.numeroVente}"`,
      `"${v.date ? new Date(v.date).toLocaleDateString('fr-FR') : ''}"`,
      `"${v.codeClient || ''}"`,
      `"${v.matriculeCommercial || ''}"`,
      `"${v.typeVente || 'NORMALE'}"`,
      v.montantTotal || 0,
      `"${v.statut}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `journal_ventes_tanty_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast(`${list.length} vente(s) exportée(s) en CSV.`, 'success');
  }

  ngOnInit(): void {
    this.chargerVentes();
    this.svc.getReglesAvarieCourantes().pipe(takeUntil(this.d$)).subscribe({
      next: r => this.seuilPhotoAvarie.set(r.quantiteSeuilPhotoObligatoire),
      error: () => this.showToast("Seuil photo avarie non chargé, la photo sera exigée par précaution pour toute avarie.", 'error'),
    });
  }

  /**
   * Vrai si le type/la quantité saisie exige une photo, selon le seuil réel en vigueur.
   *
   * Si le seuil n'a pas pu être chargé (`null`), on exige la photo par défaut plutôt que de ne
   * jamais la demander : avant ce correctif (2026-10-21, mode autonome), un échec silencieux du
   * chargement du seuil désactivait entièrement l'obligation de photo pour toute la session,
   * une déclaration d'avarie de n'importe quelle quantité passait alors sans preuve, contraire à
   * la règle métier (§5.4 du contexte projet : « Avarie > 5% → photo obligatoire »).
   */
  photoRequise(): boolean {
    const seuil = this.seuilPhotoAvarie();
    if (this.nmTypeVente !== 'AVARIE') return false;
    return seuil === null || this.nmQuantite >= seuil;
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.nmPhotoFile = input.files[0];
    this.nmPhotoDocId = null;
    this.uploadingPhoto.set(true);
    const reference = `AVARIE-${this.nmCodeProduit || 'PROD'}-${Date.now()}`;
    this.docSvc.importer('PHOTO_AVARIE', reference, this.nmPhotoFile).pipe(takeUntil(this.d$)).subscribe({
      next: doc => { this.uploadingPhoto.set(false); this.nmPhotoDocId = doc.id; },
      error: (e) => { this.uploadingPhoto.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  chargerVentes(): void {
    this.loading.set(true);
    const now = new Date();
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.svc.getVentes(fmt(debut), fmt(now)).pipe(takeUntil(this.d$)).subscribe({
      next: page => { this.ventes.set(page.contenu); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  finaliserVente(numero: string): void {
    this.svc.finaliserVente(numero).pipe(takeUntil(this.d$)).subscribe({
      next: v => this.ventes.update(list => list.map(x => x.numeroVente === numero ? v : x)),
      error: (e) => this.showToast(extractApiError(e), 'error'),
    });
  }

  openAnnuler(numero: string): void {
    this.selectedNumero = numero;
    this.annulerMotif = '';
    this.showAnnuler.set(true);
  }

  confirmerAnnuler(): void {
    if (this.saving() || !this.annulerMotif) return;
    this.saving.set(true);
    this.svc.annulerVente(this.selectedNumero, this.annulerMotif).pipe(takeUntil(this.d$)).subscribe({
      next: v => {
        this.ventes.update(list => list.map(x => x.numeroVente === this.selectedNumero ? v : x));
        this.saving.set(false);
        this.showAnnuler.set(false);
        this.showToast('Vente annulée.', 'success');
      },
      error: (e) => { this.saving.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  openNonMarchand(): void {
    this.nmTypeVente = 'DON';
    this.nmCodeClient = '';
    this.nmCodeProduit = '';
    this.nmDesignation = '';
    this.nmQuantite = 1;
    this.nmMotif = '';
    this.nmPhotoFile = null;
    this.nmPhotoDocId = null;
    this.showNonMarchand.set(true);
  }

  confirmerNonMarchand(): void {
    if (this.saving() || !this.nmCodeClient || !this.nmCodeProduit) return;
    if (this.photoRequise() && !this.nmPhotoDocId) {
      this.showToast(`Une photo est obligatoire au-delà de ${this.seuilPhotoAvarie()} unité(s) pour une avarie.`, 'error');
      return;
    }
    this.saving.set(true);
    const matricule = this.auth.user()?.matricule ?? '';
    const now = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.svc.declarerNonMarchand({
      typeVente: this.nmTypeVente,
      matriculeCommercial: matricule,
      codeClient: this.nmCodeClient,
      codeProduit: this.nmCodeProduit,
      designationProduit: this.nmDesignation,
      conditionnement: this.nmConditionnement,
      quantite: this.nmQuantite,
      date: fmt(now),
      motif: this.nmMotif,
      photoJustificative: this.nmPhotoDocId !== null ? String(this.nmPhotoDocId) : undefined,
    }).pipe(takeUntil(this.d$)).subscribe({
      next: v => {
        this.ventes.update(list => [v, ...list]);
        this.saving.set(false);
        this.showNonMarchand.set(false);
        this.showToast('Transaction non marchande enregistrée.', 'success');
      },
      error: (e) => { this.saving.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  openAvoir(numero: string): void {
    this.selectedNumero = numero;
    this.avoirMotif = '';
    this.showAvoir.set(true);
  }

  confirmerAvoir(): void {
    if (this.saving() || !this.avoirMotif) return;
    this.saving.set(true);
    this.svc.emettreAvoir(this.selectedNumero, {
      matriculeComptable: this.auth.user()?.matricule ?? '',
      motif: this.avoirMotif,
    }).pipe(takeUntil(this.d$)).subscribe({
      next: a => {
        this.avoirs.update(list => [a, ...list]);
        this.saving.set(false);
        this.showAvoir.set(false);
        this.showToast(`Avoir ${a.numeroAvoir} émis.`, 'success');
      },
      error: (e) => { this.saving.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  validerAvoir(numeroAvoir: string): void {
    this.svc.validerAvoir(numeroAvoir).pipe(takeUntil(this.d$)).subscribe({
      next: a => this.avoirs.update(list => list.map(x => x.numeroAvoir === numeroAvoir ? a : x)),
      error: (e) => this.showToast(extractApiError(e), 'error'),
    });
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      EN_COURS: 'badge bg-orange', FINALISEE: 'badge bg-success', ANNULEE: 'badge bg-red',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy(): void {
    this.d$.next();
    this.d$.complete();
  }
}
