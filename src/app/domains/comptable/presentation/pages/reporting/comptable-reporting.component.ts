import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComptableService, VersementBE, FactureBE } from '../../../infrastructure/comptable.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-comptable-reporting',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './comptable-reporting.component.html',
  styleUrls: ['./comptable-reporting.component.css']
})
export class ComptableReportingComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  private readonly cptSvc = inject(ComptableService);

  versements = signal<VersementBE[]>([]);
  factures = signal<FactureBE[]>([]);

  totalVersements = computed(() =>
    this.versements().reduce((s, v) => s + (v.cashVerse ?? 0), 0)
  );

  totalFacturesTTC = computed(() =>
    this.factures().filter(f => f.typeFacture === 'FACTURE')
      .reduce((s, f) => s + f.lignes.reduce((ls, l) => ls + l.montantTTC, 0), 0)
  );

  // Créances = factures (hors avoirs) dont le statut n'est pas PAYEE — dérivé
  // des factures déjà chargées, pas une valeur inventée. Le module comptable
  // ne calcule pas encore un "solde restant" par facture (paiement partiel) :
  // ce total suppose donc une facture soit intégralement payée, soit pas du
  // tout — à affiner si un paiement partiel est introduit un jour.
  totalCreances = computed(() =>
    this.factures().filter(f => f.typeFacture === 'FACTURE' && f.statut !== 'PAYEE')
      .reduce((s, f) => s + f.lignes.reduce((ls, l) => ls + l.montantTTC, 0), 0)
  );

  ngOnInit(): void {
    const today = new Date();
    const debut = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const fin = today.toISOString().split('T')[0];
    this.cptSvc.getVersements().subscribe({
      next: v => this.versements.set(v),
      error: () => {},
    });
    this.cptSvc.getFactures(debut, fin).subscribe({
      next: page => this.factures.set(page.contenu),
      error: () => {},
    });
  }

  getFactureTTC(f: FactureBE): number {
    return f.lignes.reduce((s, l) => s + l.montantTTC, 0);
  }
}
