import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, VenteBE, AvoirBE } from '../../../infrastructure/commercial.service';
import { DocumentService } from '../../../../shared/infrastructure/document.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { CanDirective } from '../../../../../shared/directives/can.directive';

@Component({
  selector: 'app-commercial-ventes',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, CanDirective],
  templateUrl: './commercial-ventes.component.html',
  styleUrls: ['./commercial-ventes.component.css']
})
export class CommercialVentesComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private svc = inject(CommercialService);
  private auth = inject(AuthService);
  private docSvc = inject(DocumentService);

  loading = signal(true);
  ventes = signal<VenteBE[]>([]);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  showAnnuler = signal(false);
  showNonMarchand = signal(false);
  showAvoir = signal(false);
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

  /** Seuil réel (unités de base) au-delà duquel une photo est exigée pour une avarie — jamais codé en dur, lu au serveur. */
  seuilPhotoAvarie = signal<number | null>(null);
  nmPhotoFile: File | null = null;
  nmPhotoDocId: number | null = null;
  uploadingPhoto = signal(false);

  avoirMotif = '';
  avoirs = signal<AvoirBE[]>([]);

  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  ngOnInit(): void {
    this.chargerVentes();
    this.svc.getReglesAvarieCourantes().pipe(takeUntil(this.d$)).subscribe({
      next: r => this.seuilPhotoAvarie.set(r.quantiteSeuilPhotoObligatoire),
      error: () => this.showToast("Seuil photo avarie non chargé — la photo sera exigée par précaution pour toute avarie.", 'error'),
    });
  }

  /**
   * Vrai si le type/la quantité saisie exige une photo, selon le seuil réel en vigueur.
   *
   * Si le seuil n'a pas pu être chargé (`null`), on exige la photo par défaut plutôt que de ne
   * jamais la demander : avant ce correctif (2026-10-21, mode autonome), un échec silencieux du
   * chargement du seuil désactivait entièrement l'obligation de photo pour toute la session —
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
