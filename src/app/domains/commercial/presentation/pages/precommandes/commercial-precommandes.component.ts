import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, PreCommandeBE } from '../../../infrastructure/commercial.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { Product } from '../../../../stock/domain/models/stock.models';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface LigneUI { produitCode: string; designation: string; quantite: number }

interface PrecommandeUI {
  id: string; commercialId: string; dateCommande: Date; statut: string;
  lignes: LigneUI[]; signatureSecretaire: boolean; signatureComptable: boolean;
}

@Component({
  selector: 'app-commercial-precommandes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './commercial-precommandes.component.html',
  styleUrls: ['./commercial-precommandes.component.css']
})
export class CommercialPrecommandesComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly d$ = new Subject<void>();

  today = new Date();
  produits = signal<{ code: string; designation: string; gamme: string; prixHT: number; unite: string }[]>([]);
  precommandes = signal<PrecommandeUI[]>([]);
  loading = signal(false);
  showForm = signal(false);
  submitted = signal(false);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  lignes = signal<LigneUI[]>([
    { produitCode: '', designation: '', quantite: 0 },
  ]);

  ngOnInit(): void {
    const demain = this.fmtDate(new Date(Date.now() + 86_400_000));
    this.loading.set(true);
    this.svc.getPrecommandesParDate(demain).pipe(takeUntil(this.d$)).subscribe({
      next: page => {
        const matricule = this.auth.user()?.matricule;
        this.precommandes.set(
          page.contenu
            .filter(pc => !matricule || pc.matriculeCommercial === matricule)
            .map(this.mapPC)
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  soumettre(): void {
    const valid = this.lignes().filter(l => l.quantite > 0 && l.produitCode);
    if (!valid.length) return;
    const matricule = this.auth.user()?.matricule ?? '';
    this.svc.soumettrePrecommande({
      matriculeCommercial: matricule,
      dateSoumission: this.fmtDate(new Date()),
      lignes: valid.map(l => ({
        codeProduit: l.produitCode,
        designation: l.designation,
        conditionnement: 'CARTON',
        quantite: l.quantite,
      })),
    }).subscribe({
      next: pc => {
        this.precommandes.update(list => [this.mapPC(pc), ...list]);
        this.submitted.set(true);
        this.showForm.set(false);
        this.lignes.set([{ produitCode: '', designation: '', quantite: 0 }]);
      },
    });
  }

addLigne(): void { this.lignes.update(l => [...l, { produitCode: '', designation: '', quantite: 0 }]); }
  removeLigne(i: number): void { this.lignes.update(l => l.filter((_, idx) => idx !== i)); }

  showRefus = signal(false);
  refusNumero = '';
  refusMotif = '';
  refusSaving = signal(false);
  toastMsg = signal('');
  toastType = signal<'success'|'error'>('success');

  openRefus(numero: string): void {
    this.refusNumero = numero;
    this.refusMotif = '';
    this.showRefus.set(true);
  }

  confirmerRefus(): void {
    if (this.refusSaving() || !this.refusMotif) return;
    this.refusSaving.set(true);
    const matricule = this.auth.user()?.matricule ?? '';
    this.svc.refuserPrecommande(this.refusNumero, this.refusMotif, matricule).pipe(takeUntil(this.d$)).subscribe({
      next: pc => {
        this.precommandes.update(list => list.map(x => x.id === this.refusNumero ? this.mapPC(pc) : x));
        this.refusSaving.set(false);
        this.showRefus.set(false);
        this.showToast('Précommande refusée.', 'success');
      },
      error: (e) => { this.refusSaving.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  livrer(numero: string): void {
    this.svc.livrerPrecommande(numero).pipe(takeUntil(this.d$)).subscribe({
      next: pc => {
        this.precommandes.update(list => list.map(x => x.id === numero ? this.mapPC(pc) : x));
        this.showToast('Précommande livrée.', 'success');
      },
      error: (e) => this.showToast(extractApiError(e), 'error'),
    });
  }

  showToast(msg: string, type: 'success'|'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy(): void { this.d$.next(); this.d$.complete(); }

  getStatutLabel(s: string): string {
    const map: Record<string, string> = {
      SOUMISE: 'Soumise',
      VALIDEE_SECRETAIRE: 'Validée Secrétaire',
      VALIDEE_COMPTABLE: 'Prête Chargement',
    };
    return map[s] ?? s;
  }

  private mapPC(pc: PreCommandeBE): PrecommandeUI {
    return {
      id: pc.numeroPreCommande,
      commercialId: pc.matriculeCommercial,
      dateCommande: new Date(pc.dateSoumission),
      statut: pc.statut,
      lignes: pc.lignes.map(l => ({
        produitCode: l.codeProduit,
        designation: l.designationProduit,
        quantite: l.quantiteDemandee,
      })),
      signatureSecretaire: !!pc.matriculeValidateurSecretaire,
      signatureComptable: !!pc.matriculeValidateurComptable,
    };
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  getProduit(code: string) {
    return this.produits().find(p => p.code === code);
  }
}
