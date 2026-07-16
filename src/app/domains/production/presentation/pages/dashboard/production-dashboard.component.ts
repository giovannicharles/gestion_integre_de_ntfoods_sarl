import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductionService, LotBE, OFBE } from '../../../infrastructure/production.service';

interface LotDashUI {
  id: number; productSku: string; productName: string;
  declaredQuantityKg: number; statut: string;
}

interface OrdreUI {
  id: string; designation: string; qteDemandee: number;
  qteRealisee: number; dateButoir: Date; statut: string;
}

interface LignePlanUI { codeProduit: string; qtePrevue: number; qteRealisee: number; }

interface PlanUI {
  semaine: string; dateDebut: string; dateFin: string;
  chefProduction: string; statut: string;
  lignesProduitsFinis: LignePlanUI[];
}

interface EmployeUI { id: string; nom: string; poste: string; present: boolean; }

@Component({
  selector: 'app-production-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './production-dashboard.component.html',
  styleUrls: ['./production-dashboard.component.css']
})
export class ProductionDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  Math = Math;
  loading = signal(true);

  lots = signal<LotDashUI[]>([]);
  ordres: OrdreUI[] = [];

  plan = signal<PlanUI>({
    semaine: '—', dateDebut: '—', dateFin: '—',
    chefProduction: '—', statut: '—', lignesProduitsFinis: [],
  });
  employes = signal<EmployeUI[]>([]);
  kpi = {
    quantiteProduiteKg: 0, quantiteConditionneeCartons: 0,
    rendementMatiere: 0, tauxRebut: 0, trs: 0,
    productiviteHoraire: 0, valorisationJour: 0,
  };
  carburant: { id: string; immatriculation: string; litresDemandes: number; montant: number; statut: string }[] = [];
  maintenance: { equipement: string; etat: string; prochaineMaint?: Date }[] = [];
  variance: { poste: string; standard: number; reel: number; unite: string }[] = [];

  nbPresents = computed(() => this.employes().filter(e => e.present).length);
  nbLotsDeclares = computed(() => this.lots().filter(l => l.statut === 'DECLARED_BY_PRODUCTION').length);
  nbLotsValides = computed(() => this.lots().filter(l => l.statut === 'VALIDATED_BY_STOCK').length);
  maintenanceAlertes = computed(() => this.maintenance.filter(m => m.etat !== 'OPERATIONNEL').length);

  ofEnCours = signal(0);
  ofHonores = signal(0);
  tauxCharge = signal(0);

  carburantAValider(): number {
    return this.carburant.filter(c => c.statut !== 'VALIDEE').length;
  }

  ngOnInit(): void {
    forkJoin({
      lots: this.svc.getLots(),
      ofs: this.svc.getOFs(),
    }).subscribe({
      next: ({ lots, ofs }) => {
        this.lots.set(lots.map(l => ({
          id: l.id,
          productSku: l.productSku ?? '',
          productName: l.productName ?? '',
          declaredQuantityKg: l.declaredQuantityKg,
          statut: l.status,
        })));
        this.ordres = ofs.map(o => ({
          id: o.id,
          designation: o.designation,
          qteDemandee: o.quantiteDemandee,
          qteRealisee: o.quantiteRealisee,
          dateButoir: new Date(o.dateFin ?? o.dateCreation),
          statut: o.statut,
        }));
        this.ofEnCours.set(ofs.filter(o => o.statut === 'EN_COURS').length);
        this.ofHonores.set(ofs.filter(o => o.statut === 'HONORE').length);
        const dem = ofs.reduce((s, o) => s + o.quantiteDemandee, 0);
        const rea = ofs.reduce((s, o) => s + o.quantiteRealisee, 0);
        this.tauxCharge.set(dem ? Math.round((rea / dem) * 100) : 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getProduitDesignation(code: string): string {
    return this.lots().find(l => l.productSku === code)?.productName ?? code;
  }

  progression(realise: number, prevu: number): number {
    if (prevu === 0) return 0;
    return Math.min(Math.round((realise / prevu) * 100), 100);
  }

  progressClass(pct: number): string {
    if (pct >= 100) return 'prog-bar prog-g';
    if (pct >= 60) return 'prog-bar prog-y';
    return 'prog-bar prog-r';
  }
}
