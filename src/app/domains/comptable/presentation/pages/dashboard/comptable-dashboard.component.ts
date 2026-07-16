import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ComptableService, DashboardComptabiliteBE } from '../../../infrastructure/comptable.service';
import { CommercialService } from '../../../../commercial/infrastructure/commercial.service';

interface VersementDashUI {
  id: number; commercialId: string; cashVerse: number;
  typeVersement: string | null; statut: string; alerteRouge: boolean;
}

interface FactureDashUI {
  id: number; numero: string; clientNom: string; type: string;
  montantHT: number; montantTTC: number; statut: string;
}

interface RecouvrementDashUI { montantDu: number; montantRembourse: number; statut: string; }

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

  today = new Date();
  loading = signal(true);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  Math = Math;

  versements: VersementDashUI[] = [];
  factures: FactureDashUI[] = [];
  recouvrement: RecouvrementDashUI[] = [];
  precommandes: { id: string; commercialId: string; lignes: unknown[]; statut: string }[] = [];
  charges: { categorie: string; montant: number; part: number }[] = [];
  variance: { poste: string; standard: number; reel: number }[] = [];
  primes: { commercialId: string; nom: string; tauxGlobal: number; gammesValidees: number; gammesTotal: number; eligible: boolean; montant: number }[] = [];
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
  totalCharges(): number { return Math.round(this.totalFacture() * 0.4); }
  resultat(): number { return this.totalFacture() - this.totalCharges(); }
  margeNette(): number {
    const ca = this.totalFacture();
    return ca ? Math.round((this.resultat() / ca) * 100) : 0;
  }
  dso(): number {
    const ca = this.totalFacture();
    return ca ? Math.round((this.totalDettes() / ca) * 30) : 0;
  }
  totalPrimes(): number { return this.primes.filter(p => p.eligible).reduce((s, p) => s + p.montant, 0); }
  variancePct(v: { standard: number; reel: number }): number {
    return v.standard ? Math.round(((v.reel - v.standard) / v.standard) * 100) : 0;
  }

  ngOnInit(): void {
    const now = new Date();
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    forkJoin({
      dashboard: this.svcC.getDashboard(),
      versements: this.svcC.getVersements({ date: fmt(now) }),
      factures: this.svcC.getFactures(fmt(debut), fmt(now)),
      recouvrement: this.svcCom.getRecouvrements(),
    }).subscribe({
      next: ({ dashboard, versements, factures, recouvrement }) => {
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
        this.caMois = factures.contenu.reduce((s, f) => s + f.montantTotalTTC, 0);
        this.loading.set(false);
      },
      error: (_e: unknown) => this.loading.set(false),
    });
  }
}
