import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ComptableService, DashboardComptabiliteBE, PrimeSemaineBE } from '../../../infrastructure/comptable.service';
import { CommercialService, PreCommandeBE } from '../../../../commercial/infrastructure/commercial.service';
import { ControleService, BudgetItem, VarianceItem } from '../../../../controle/infrastructure/controle.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface VersementDashUI {
  id: number; commercialId: string; cashVerse: number;
  typeVersement: string | null; statut: string; alerteRouge: boolean;
}

interface FactureDashUI {
  id: number; numero: string; clientNom: string; type: string;
  montantHT: number; montantTTC: number; statut: string;
}

interface RecouvrementDashUI { montantDu: number; montantRembourse: number; statut: string; }

interface PrecommandeDashUI { id: string; commercialId: string; nbLignes: number; statut: string; }

interface PrimeDashUI {
  commercialId: string; tauxGlobal: number;
  gammesValidees: number; gammesTotal: number;
  eligible: boolean; montant: number;
}

@Component({
  selector: 'app-comptable-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './comptable-dashboard.component.html',
  styleUrls: ['./comptable-dashboard.component.css']
})
export class ComptableDashboardComponent implements OnInit {
  private readonly svcC = inject(ComptableService);
  private readonly svcCom = inject(CommercialService);
  private readonly svcCtrl = inject(ControleService);

  today = new Date();
  loading = signal(true);
  loadError = signal<string | null>(null);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  Math = Math;

  versements: VersementDashUI[] = [];
  factures: FactureDashUI[] = [];
  recouvrement: RecouvrementDashUI[] = [];
  precommandes: PrecommandeDashUI[] = [];
  budget: BudgetItem[] = [];
  variance: VarianceItem[] = [];
  primes: PrimeDashUI[] = [];
  fiche = { sCaisse: 0, totalEntrees: 0, totalSorties: 0, totalDecaissements: 0, nbDecaissementsEnAttente: 0, nbFacturesImpayees: 0, nbVersementsEnAttente: 0, nbAlertesRouges: 0, nbPrimesValidees: 0, totalPrimesAVerser: 0 };
  caMois = 0;
  primeMontant = 0;

  commandesEnAttente = signal(0);

  totalVersements(): number { return this.versements.reduce((s, v) => s + v.cashVerse, 0); }
  versementsValides(): number { return this.versements.filter(v => v.statut === 'VALIDE').length; }
  versementsEnAttente(): number { return this.versements.filter(v => v.statut !== 'VALIDE').length; }
  totalFacture(): number { return this.factures.reduce((s, f) => s + f.montantTTC, 0); }
  facturesEmises(): number { return this.factures.filter(f => f.statut === 'EMISE').length; }
  caFactureReel(): number { return this.factures.filter(f => f.type === 'FACTURE').reduce((s, f) => s + f.montantHT, 0); }
  totalDettes(): number { return this.recouvrement.reduce((s, r) => s + r.montantDu, 0); }
  totalEncaisse(): number { return this.recouvrement.reduce((s, r) => s + r.montantRembourse, 0); }
  dossierActifs(): number { return this.recouvrement.filter(r => r.statut !== 'APURE').length; }
  dso(): number {
    const ca = this.totalFacture();
    return ca ? Math.round((this.totalDettes() / ca) * 30) : 0;
  }
  totalPrimes(): number { return this.primes.filter(p => p.eligible).reduce((s, p) => s + p.montant, 0); }
  budgetPart(b: BudgetItem): number {
    const total = this.budget.reduce((s, x) => s + x.engage, 0);
    return total ? Math.round((b.engage / total) * 100) : 0;
  }
  variancePct(v: VarianceItem): number {
    return v.standard ? Math.round(((v.reel - v.standard) / v.standard) * 100) : 0;
  }

  private lundiCourant(): string {
    const now = new Date();
    const decalage = (now.getDay() + 6) % 7;
    const lundi = new Date(now);
    lundi.setDate(now.getDate() - decalage);
    return `${lundi.getFullYear()}-${String(lundi.getMonth() + 1).padStart(2, '0')}-${String(lundi.getDate()).padStart(2, '0')}`;
  }

  private gammesValideesDe(p: PrimeSemaineBE): { validees: number; total: number } {
    const realisations = p.realisationsParGammeFCFA ?? {};
    const objectifs = p.objectifsParGammeFCFA ?? {};
    const gammes = Object.keys(objectifs);
    const validees = gammes.filter(g => (objectifs[g] ?? 0) > 0 && (realisations[g] ?? 0) / objectifs[g] >= 0.75).length;
    return { validees, total: gammes.length };
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const now = new Date();
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    forkJoin({
      dashboard: this.svcC.getDashboard(),
      versements: this.svcC.getVersements({ date: fmt(now) }),
      factures: this.svcC.getFactures(fmt(debut), fmt(now)),
      recouvrement: this.svcCom.getRecouvrements(),
      precommandes: this.svcCom.getPrecommandesAValiderComptable(),
      controle: this.svcCtrl.getDashboard(),
      primes: this.svcC.getPrimesParSemaine(this.lundiCourant()),
    }).subscribe({
      next: ({ dashboard, versements, factures, recouvrement, precommandes, controle, primes }) => {
        this.fiche = {
          sCaisse: dashboard.soldeCaisse,
          totalEntrees: dashboard.totalEntreesCaisse,
          totalSorties: dashboard.totalSortiesCaisse,
          totalDecaissements: dashboard.totalDecaissementsExecutes,
          nbDecaissementsEnAttente: dashboard.nbDecaissementsEnAttente,
          nbFacturesImpayees: dashboard.nbFacturesImpayees,
          nbVersementsEnAttente: dashboard.nbVersementsEnAttente,
          nbAlertesRouges: dashboard.nbAlertesRouges,
          nbPrimesValidees: dashboard.nbPrimesValideesNonVersées,
          totalPrimesAVerser: dashboard.totalPrimesAVerser,
        };
        this.primeMontant = dashboard.totalPrimesAVerser;
        this.versements = versements.map(v => ({
          id: v.id,
          commercialId: v.matriculeCommercial,
          cashVerse: v.cashVerse,
          typeVersement: v.typeVersement ?? null,
          statut: v.statut,
          alerteRouge: v.alerteRouge,
        }));
        this.factures = factures.contenu.map(f => ({
          id: f.id,
          numero: f.numeroFacture,
          clientNom: f.codeClient,
          type: f.typeFacture,
          montantHT: f.montantTotalHT,
          montantTTC: f.montantTotalTTC,
          statut: f.statut,
        }));
        this.recouvrement = recouvrement.map(r => ({
          montantDu: r.montantDu,
          montantRembourse: r.montantRembourse,
          statut: r.statut,
        }));
        this.precommandes = precommandes.contenu.map(p => ({
          id: p.numeroPreCommande,
          commercialId: p.matriculeCommercial,
          nbLignes: p.lignes.length,
          statut: p.statut,
        }));
        this.commandesEnAttente.set(precommandes.contenu.filter(p => p.statut === 'VALIDEE_SECRETAIRE').length);
        this.budget = controle.budget;
        this.variance = controle.variances;
        this.primes = primes.map(p => {
          const { validees, total } = this.gammesValideesDe(p);
          return {
            commercialId: p.matriculeCommercial,
            tauxGlobal: p.tauxRealisationGlobalPourcent,
            gammesValidees: validees,
            gammesTotal: total,
            eligible: p.eligible,
            montant: p.montantPrimeFCFA,
          };
        });
        this.caMois = factures.contenu.reduce((s, f) => s + f.montantTotalTTC, 0);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loadError.set(extractApiError(e));
        this.loading.set(false);
      },
    });
  }
}
