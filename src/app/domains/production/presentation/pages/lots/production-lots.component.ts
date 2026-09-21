import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProductionService, LotBE, PPHBE } from '../../../infrastructure/production.service';

interface LotFormLigne {
  codeProduit: string;
  designationProduit: string;
  referencePPH: string;
  quantiteKg: number;
  nbCartons: number;
  dlc: string;
}

@Component({
  selector: 'app-production-lots',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './production-lots.component.html',
  styleUrls: ['./production-lots.component.css']
})
export class ProductionLotsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  today = new Date();
  loading = signal(false);

  lots = signal<LotBE[]>([]);
  lotsAValider = signal<LotBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  showDeclarerLot = signal(false);
  showRejeter = signal<LotBE | null>(null);
  motifRejet = '';
  message = signal('');

  dateProduction = this.formatDate(new Date());
  lignesLot: LotFormLigne[] = [];

  nbDeclares = computed(() => this.lots().filter(l => l.statut === 'DECLARE').length);
  nbValidesStock = computed(() => this.lots().filter(l => l.statut === 'VALIDATED_BY_STOCK').length);
  nbRejetes = computed(() => this.lots().filter(l => l.statut === 'REJETE').length);
  totalKgDeclares = computed(() => this.lots().reduce((s, l) => s + l.quantiteKg, 0));
  totalCartons = computed(() => this.lots().reduce((s, l) => s + l.nbCartons, 0));

  ngOnInit(): void {
    this.chargerLots();
    this.chargerLotsAValider();
    this.svc.getPPHs().subscribe({ next: p => this.pphs.set(p) });
  }

  chargerLots(): void {
    this.loading.set(true);
    this.svc.getLots().subscribe({
      next: list => { this.lots.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /** Lots déclarés en attente de validation par le Gestionnaire de Stock. */
  chargerLotsAValider(): void {
    this.svc.getLotsAValider().subscribe({
      next: list => this.lotsAValider.set(list),
      error: () => {},
    });
  }

  declarerLot(): void {
    const valides = this.lignesLot.filter(l =>
      l.codeProduit && l.designationProduit && l.referencePPH && l.quantiteKg > 0 && l.dlc
    );
    if (valides.length === 0) {
      this.message.set('Veuillez renseigner au moins une ligne valide.');
      return;
    }
    const req = valides.map(l => ({ ...l, dateProduction: this.dateProduction || undefined }));
    forkJoin(req.map(r => this.svc.declarerLot(r))).subscribe({
      next: crees => {
        this.lots.update(list => [...crees, ...list]);
        this.chargerLotsAValider();
        this.showDeclarerLot.set(false);
        this.lignesLot = [];
        this.message.set(`${crees.length} lot(s) déclaré(s) — en attente de validation stock`);
      },
      error: () => this.message.set('Erreur lors de la déclaration des lots')
    });
  }

  ouvrirDeclarerLot(): void {
    this.dateProduction = this.formatDate(new Date());
    this.lignesLot = [this.ligneVide()];
    this.showDeclarerLot.set(true);
  }

  ajouterLigne(): void {
    this.lignesLot = [...this.lignesLot, this.ligneVide()];
  }

  supprimerLigne(i: number): void {
    this.lignesLot = this.lignesLot.filter((_, idx) => idx !== i);
  }

  private ligneVide(): LotFormLigne {
    return { codeProduit: '', designationProduit: '', referencePPH: '', quantiteKg: 0, nbCartons: 0, dlc: '' };
  }

  private formatDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /** Validation physique par le Gestionnaire de Stock — déclenche le verrouillage de la fiche. */
  validerLot(lot: LotBE): void {
    if (!confirm(`Valider le lot ${lot.numeroLot} et l'intégrer au stock central ?`)) return;
    this.svc.validerLot(lot.numeroLot).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.lotsAValider.update(list => list.filter(x => x.numeroLot !== l.numeroLot));
        this.message.set('Lot validé — fiche de production verrouillée');
      },
      error: () => this.message.set('Erreur lors de la validation du lot')
    });
  }

  ouvrirRejeter(lot: LotBE): void {
    this.motifRejet = '';
    this.showRejeter.set(lot);
  }

  confirmerRejet(): void {
    const lot = this.showRejeter();
    if (!lot || !this.motifRejet.trim()) return;
    this.svc.rejeterLot(lot.numeroLot, this.motifRejet.trim()).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.lotsAValider.update(list => list.filter(x => x.numeroLot !== l.numeroLot));
        this.showRejeter.set(null);
        this.message.set('Lot rejeté');
      },
      error: () => this.message.set('Erreur lors du rejet du lot')
    });
  }

  private remplacerLot(l: LotBE): void {
    this.lots.update(list => list.map(x => x.numeroLot === l.numeroLot ? l : x));
  }

  statutClass(s: string): string {
    if (s === 'VALIDATED_BY_STOCK') return 'badge bg-success';
    if (s === 'REJETE') return 'badge bg-red';
    if (s === 'RECEPTIONNE_STOCK') return 'badge bg-neutral';
    return 'badge bg-orange';
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      DECLARE: 'Déclaré Production',
      RECEPTIONNE_STOCK: 'Réceptionné Stock',
      VALIDATED_BY_STOCK: 'Validé Stock',
      REJETE: 'Rejeté',
    };
    return map[s] ?? s;
  }
}
