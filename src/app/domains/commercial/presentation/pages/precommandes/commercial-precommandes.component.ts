import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, PreCommandeBE } from '../../../infrastructure/commercial.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface LigneUI { produitCode: string; designation: string; quantite: number }

interface ProduitUI {
  code: string; designation: string; gamme: string; prixHT: number; unite: string;
}

interface PrecommandeUI {
  id: string; commercialId: string; dateCommande: Date; statut: string;
  lignes: LigneUI[]; signatureSecretaire: boolean; signatureComptable: boolean;
}

@Component({
  selector: 'app-commercial-precommandes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './commercial-precommandes.component.html',
  styleUrls: ['./commercial-precommandes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialPrecommandesComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly d$ = new Subject<void>();

  today = new Date();
  precommandes = signal<PrecommandeUI[]>([]);
  filtreStatut = signal<'TOUS' | 'EN_ATTENTE' | 'VALIDEE_SECRETAIRE' | 'VALIDEE_COMPTABLE' | 'REFUSEE'>('TOUS');
  filtreTexte = signal<string>('');
  loading = signal(false);
  showForm = signal(false);
  submitted = signal(false);
  showBonModal = signal(false);
  selectedPrecommande = signal<PrecommandeUI | null>(null);

  lignes = signal<LigneUI[]>([
    { produitCode: '', designation: '', quantite: 0 },
  ]);
  produits = signal<ProduitUI[]>([]);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  nbTotal = computed(() => this.precommandes().length);
  nbPretChargement = computed(() => this.precommandes().filter(p => p.statut === 'VALIDEE_COMPTABLE').length);
  nbAttente = computed(() => this.precommandes().filter(p => p.statut !== 'VALIDEE_COMPTABLE' && p.statut !== 'REFUSEE').length);
  totalCartons = computed(() => this.precommandes().reduce((sum, p) => sum + p.lignes.reduce((s, l) => s + (l.quantite || 0), 0), 0));

  precommandesFiltrees = computed(() => {
    const st = this.filtreStatut();
    const t = this.filtreTexte().trim().toLowerCase();

    return this.precommandes().filter(p => {
      let matchStatut = true;
      if (st === 'EN_ATTENTE') matchStatut = p.statut === 'EN_ATTENTE' || !p.signatureSecretaire;
      else if (st === 'VALIDEE_SECRETAIRE') matchStatut = p.statut === 'VALIDEE_SECRETAIRE';
      else if (st === 'VALIDEE_COMPTABLE') matchStatut = p.statut === 'VALIDEE_COMPTABLE';
      else if (st === 'REFUSEE') matchStatut = p.statut === 'REFUSEE';

      const matchText = !t ||
        p.id.toLowerCase().includes(t) ||
        p.lignes.some(l => (l.designation || '').toLowerCase().includes(t) || l.produitCode.toLowerCase().includes(t));

      return matchStatut && matchText;
    });
  });

  setFiltreStatut(st: 'TOUS' | 'EN_ATTENTE' | 'VALIDEE_SECRETAIRE' | 'VALIDEE_COMPTABLE' | 'REFUSEE'): void {
    if (this.filtreStatut() === st && st !== 'TOUS') {
      this.filtreStatut.set('TOUS');
    } else {
      this.filtreStatut.set(st);
    }
  }

  imprimerBon(pcm: PrecommandeUI): void {
    this.selectedPrecommande.set(pcm);
    this.showBonModal.set(true);
  }

  fermerBon(): void {
    this.showBonModal.set(false);
    this.selectedPrecommande.set(null);
  }

  lancerImpression(): void {
    window.print();
  }

  exporterCsv(): void {
    const list = this.precommandesFiltrees();
    if (!list.length) {
      this.showToast('Aucune précommande à exporter.', 'error');
      return;
    }
    const headers = ['N° Precommande', 'Commercial', 'Date', 'Statut', 'Nb Produits', 'Detail Lignes'];
    const rows = list.map(p => [
      `"${p.id}"`,
      `"${p.commercialId}"`,
      `"${p.dateCommande ? new Date(p.dateCommande).toLocaleDateString('fr-FR') : ''}"`,
      `"${p.statut}"`,
      p.lignes.length,
      `"${p.lignes.map(l => `${l.produitCode}: ${l.quantite}`).join(' | ')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `precommandes_tanty_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast(`${list.length} précommande(s) exportée(s) en CSV.`, 'success');
  }

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
    this.stockRepo.getProducts().subscribe({
      next: list => {
        this.produits.set(list.map(p => ({
          code: p.sku,
          designation: p.designation ?? p.sku,
          gamme: p.variant?.name ?? '-',
          prixHT: p.unitPriceAmount,
          unite: p.unit ?? 'u',
        })));
      },
      error: () => this.showToast('Impossible de charger le catalogue des produits', 'error'),
    });
  }

  getProduit(code: string): ProduitUI | undefined {
    return this.produits().find(p => p.code === code);
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
        designation: this.getProduit(l.produitCode)?.designation ?? l.produitCode,
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
      error: (e) => this.showToast(extractApiError(e), 'error'),
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
}
