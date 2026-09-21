import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComptableService, VersementBE } from '../../../../comptable/infrastructure/comptable.service';
import { CommercialService, PreCommandeBE } from '../../../../commercial/infrastructure/commercial.service';
import {
  fCFA
} from '../../../../../shared/utils/format.utils';
import { SecretaireService, PetiteCaisseResponse, MicroStockResponse, DocumentRecuResponse } from '../../../infrastructure/secretaire.service';

@Component({
  selector: 'app-secretaire-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './secretaire-dashboard.component.html',
  styleUrls: ['./secretaire-dashboard.component.css']
})
export class SecretaireDashboardComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  Math = Math;
  seuilSecurisation = 500000;

  private readonly cptSvc = inject(ComptableService);
  private readonly comSvc = inject(CommercialService);
  private readonly secSvc = inject(SecretaireService);

  versements = signal<VersementBE[]>([]);
  commandes = signal<PreCommandeBE[]>([]);
  petiteCaisse = signal<PetiteCaisseResponse[]>([]);
  microStock = signal<MicroStockResponse[]>([]);
  documents = signal<DocumentRecuResponse[]>([]);

  versementsEnAttente = computed(() =>
    this.versements().filter(v => v.statut === 'EN_ATTENTE').length
  );

  commandesAValider = computed(() =>
    this.commandes().filter(c => c.statut === 'SOUMISE').length
  );

  alertesRouges = computed(() =>
    this.versements().filter(v => v.alerteRouge).length
  );

  totalVerse = computed(() =>
    this.versements().reduce((s, v) => s + (v.cashVerse ?? 0), 0)
  );

  versementsRecents = computed(() => this.versements().slice(0, 3));

  totalEntrees = computed(() => this.petiteCaisse().filter(p => p.type === 'ENTREE').reduce((s, p) => s + p.montant, 0));
  totalSorties = computed(() => this.petiteCaisse().filter(p => p.type === 'SORTIE').reduce((s, p) => s + p.montant, 0));
  soldeCaisse = computed(() => this.totalEntrees() - this.totalSorties());
  seuilDepasse = computed(() => this.soldeCaisse() > this.seuilSecurisation);

  microStockBas = computed(() => this.microStock().filter(m => m.qte <= m.seuil).length);
  valeurMicroStock = computed(() => this.microStock().reduce((s, m) => s + m.qte * m.prixUnite, 0));

  docsIncomplets = computed(() => this.documents().filter(d => !d.feuilleRoute || !d.bonCommande || !d.factures).length);

  ngOnInit(): void {
    this.cptSvc.getVersements().subscribe({
      next: v => this.versements.set(v),
      error: () => {},
    });
    this.comSvc.getPrecommandesAValider().subscribe({
      next: c => this.commandes.set(c.contenu),
      error: () => {},
    });
    this.secSvc.getDashboard().subscribe({
      next: d => {
        this.petiteCaisse.set(d.petiteCaisse);
        this.microStock.set(d.microStock);
        this.documents.set(d.documents);
      },
      error: () => {},
    });
  }
}
