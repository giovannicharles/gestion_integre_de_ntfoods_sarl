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
  caMensuel = signal<{ mois: string; n: number; nMoins1: number }[]>([]);

  totalVersements = computed(() =>
    this.versements().reduce((s, v) => s + (v.cashVerse ?? 0), 0)
  );

  totalFacturesTTC = computed(() =>
    this.factures().filter(f => f.typeFacture === 'FACTURE')
      .reduce((s, f) => s + f.lignes.reduce((ls, l) => ls + l.montantTTC, 0), 0)
  );

  totalCreances = computed(() => 0);

  totalCaN = computed(() => 0);
  totalCaNMoins1 = computed(() => 0);

  evolutionPct = computed(() => {
    const prev = this.totalCaNMoins1();
    if (prev === 0) return 0;
    return Math.round(((this.totalCaN() - prev) / prev) * 100);
  });

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
