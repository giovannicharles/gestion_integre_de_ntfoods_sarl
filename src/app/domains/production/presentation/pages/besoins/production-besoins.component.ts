import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProductionService, ExpressionBesoinBE, PPHBE, TYPES_BESOIN, STATUTS_BESOIN
} from '../../../infrastructure/production.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { Product } from '../../../../stock/domain/models/stock.models';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-production-besoins',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, HasPermissionDirective],
  templateUrl: './production-besoins.component.html',
  styleUrls: ['./production-besoins.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionBesoinsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly toast = inject(ToastService);

  loading = signal(false);
  message = signal('');

  besoins = signal<ExpressionBesoinBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  produitsCatalogue = signal<Product[]>([]);
  typesBesoin = TYPES_BESOIN;
  statuts = STATUTS_BESOIN;

  filtreStatut = signal<string>('');
  filtreTexte = signal<string>('');

  showSignaler = signal(false);
  showRejeter = signal<ExpressionBesoinBE | null>(null);
  showDetail = signal<ExpressionBesoinBE | null>(null);
  motifRejet = '';

  nouveauBesoin = {
    numero: '', referencePPH: '', type: 'MATIERE_PREMIERE',
    codeProduit: '', designationProduit: '', quantiteDemandee: 0,
    unite: 'kg', dateBesoin: '', motif: ''
  };

  nbEnAttente = computed(() => this.besoins().filter(b => b.statut === 'EN_ATTENTE').length);
  nbValides = computed(() => this.besoins().filter(b => b.statut === 'VALIDE').length);
  nbRejetes = computed(() => this.besoins().filter(b => b.statut === 'REJETE').length);

  besoinsFiltres = computed(() => {
    const q = this.filtreTexte().trim().toLowerCase();
    const st = this.filtreStatut();
    let list = this.besoins();
    if (st) list = list.filter(b => b.statut === st);
    if (!q) return list;
    return list.filter(b =>
      b.numero.toLowerCase().includes(q) ||
      b.codeProduit.toLowerCase().includes(q) ||
      b.designationProduit.toLowerCase().includes(q) ||
      (b.referencePPH || '').toLowerCase().includes(q) ||
      (b.matriculeDemandeur || '').toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.charger();
    this.svc.getPPHs().subscribe({
      next: p => this.pphs.set(p),
      error: () => this.message.set('Impossible de charger la liste des PPH')
    });
    this.stockRepo.getProducts().subscribe({
      next: prods => this.produitsCatalogue.set(prods),
      error: () => {}
    });
  }

  onSelectProduit(sku: string): void {
    const p = this.produitsCatalogue().find(item => item.sku === sku);
    if (p) {
      this.nouveauBesoin.codeProduit = p.sku;
      this.nouveauBesoin.designationProduit = p.designation || p.sku;
      if (p.unit) this.nouveauBesoin.unite = p.unit;
    }
  }

  exporterCsv(): void {
    const list = this.besoinsFiltres();
    if (!list.length) {
      this.toast.info('Aucun besoin à exporter.');
      return;
    }
    const headers = ['Numero', 'Type', 'Code Produit', 'Designation', 'PPH', 'Quantite', 'Unite', 'Date Besoin', 'Demandeur', 'Statut'];
    const rows = list.map(b => [
      `"${b.numero}"`,
      `"${b.type}"`,
      `"${b.codeProduit}"`,
      `"${b.designationProduit}"`,
      `"${b.referencePPH || ''}"`,
      b.quantiteDemandee,
      `"${b.unite}"`,
      `"${b.dateBesoin || ''}"`,
      `"${b.matriculeDemandeur || ''}"`,
      `"${b.statut}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expressions_besoin_production_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success(`${list.length} besoin(s) exporté(s) en CSV.`);
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getBesoins(this.filtreStatut() || undefined).subscribe({
      next: list => { this.besoins.set(list); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  changerFiltre(statut: string): void {
    this.filtreStatut.set(statut);
    this.charger();
  }

  genererNumero(): void {
    const n = 'BES-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
      Math.floor(Math.random() * 900 + 100);
    this.nouveauBesoin.numero = n;
  }

  ouvrirSignaler(): void {
    this.genererNumero();
    this.showSignaler.set(true);
  }

  signaler(): void {
    const req = { ...this.nouveauBesoin, referencePPH: this.nouveauBesoin.referencePPH || undefined, dateBesoin: this.nouveauBesoin.dateBesoin || undefined };
    if (!req.numero || !req.codeProduit || !req.designationProduit || req.quantiteDemandee <= 0) {
      this.message.set('Veuillez renseigner tous les champs obligatoires');
      return;
    }
    this.svc.signalerBesoin(req).subscribe({
      next: b => {
        this.besoins.update(list => [b, ...list]);
        this.showSignaler.set(false);
        this.message.set('Besoin signalé');
        this.nouveauBesoin = { numero: '', referencePPH: '', type: 'MATIERE_PREMIERE', codeProduit: '', designationProduit: '', quantiteDemandee: 0, unite: 'kg', dateBesoin: '', motif: '' };
      },
      error: () => this.message.set('Erreur lors du signalement du besoin')
    });
  }

  valider(b: ExpressionBesoinBE): void {
    if (!confirm(`Valider le besoin ${b.numero} ?`)) return;
    this.svc.validerBesoin(b.numero).subscribe({
      next: updated => this.remplacer(updated),
      error: () => this.message.set('Erreur lors de la validation')
    });
  }

  ouvrirRejeter(b: ExpressionBesoinBE): void {
    this.motifRejet = '';
    this.showRejeter.set(b);
  }

  confirmerRejet(): void {
    const b = this.showRejeter();
    if (!b || !this.motifRejet.trim()) return;
    this.svc.rejeterBesoin(b.numero, this.motifRejet.trim()).subscribe({
      next: updated => { this.remplacer(updated); this.showRejeter.set(null); },
      error: () => this.message.set('Erreur lors du rejet')
    });
  }

  private remplacer(b: ExpressionBesoinBE): void {
    this.besoins.update(list => list.map(x => x.numero === b.numero ? b : x));
  }

  statutClass(s: string): string {
    if (s === 'VALIDE') return 'badge bg-success';
    if (s === 'REJETE') return 'badge bg-red';
    return 'badge bg-orange';
  }

  typeLabel(t: string): string {
    return this.typesBesoin.find(x => x.code === t)?.libelle ?? t;
  }

  /** Consultation détaillée d'un besoin par numéro (relecture depuis le serveur). */
  voirDetail(numero: string): void {
    this.svc.getBesoin(numero).subscribe({
      next: b => this.showDetail.set(b),
      error: () => this.message.set('Besoin introuvable')
    });
  }
}
