import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProductionService, RapportHebdomadaireProductionBE, RapportComparatifBCBE
} from '../../../infrastructure/production.service';

@Component({
  selector: 'app-production-rapports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production-rapports.component.html',
  styleUrls: ['./production-rapports.component.css']
})
export class ProductionRapportsComponent {
  private readonly svc = inject(ProductionService);

  tab: 'lots' | 'hebdomadaire' | 'comparatif' | 'responsable-salle' = 'hebdomadaire';
  message = signal('');

  private debutSemaine(d: Date): string {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }

  // Rapport lots (export fichier)
  lotsDebut = this.debutSemaine(new Date());
  lotsFin = new Date().toISOString().split('T')[0];
  lotsFormat: 'xlsx' | 'pdf' | 'csv' | 'json' = 'xlsx';

  telechargerRapportLots(): void {
    this.svc.getRapportLots(this.lotsDebut, this.lotsFin, this.lotsFormat).subscribe({
      next: blob => this.declencherTelechargement(blob, `rapport-lots-${this.lotsDebut}-${this.lotsFin}.${this.lotsFormat}`),
      error: () => this.message.set('Erreur lors de la génération du rapport des lots')
    });
  }

  // Rapport hebdomadaire de production (généré automatiquement)
  hebdoDebut = this.debutSemaine(new Date());
  hebdoFin = new Date().toISOString().split('T')[0];
  rapportHebdo = signal<RapportHebdomadaireProductionBE | null>(null);

  genererRapportHebdo(): void {
    this.svc.getRapportHebdomadaireProduction(this.hebdoDebut, this.hebdoFin).subscribe({
      next: r => this.rapportHebdo.set(r),
      error: () => this.message.set('Erreur lors de la génération du rapport hebdomadaire')
    });
  }

  objectKeys(o: Record<string, number> | undefined | null): string[] {
    return o ? Object.keys(o) : [];
  }

  // Rapport comparatif BC vs Production
  referenceBC = '';
  rapportComparatif = signal<RapportComparatifBCBE | null>(null);

  genererComparatifBC(): void {
    if (!this.referenceBC.trim()) return;
    this.svc.getRapportComparatifBC(this.referenceBC.trim()).subscribe({
      next: r => this.rapportComparatif.set(r),
      error: () => this.message.set('Erreur lors de la génération du rapport comparatif BC')
    });
  }

  tauxAvancementComparatif(): number {
    const r = this.rapportComparatif();
    if (!r || r.totalQuantitePlanifiee === 0) return 0;
    return Math.min(100, Math.round((r.totalQuantiteProduite * 100) / r.totalQuantitePlanifiee));
  }

  // Rapport du responsable de salle (vue filtrée)
  rsDebut = this.debutSemaine(new Date());
  rsFin = new Date().toISOString().split('T')[0];
  rapportRS = signal<RapportHebdomadaireProductionBE | null>(null);

  genererRapportResponsableSalle(): void {
    this.svc.getRapportResponsableSalle(this.rsDebut, this.rsFin).subscribe({
      next: r => this.rapportRS.set(r),
      error: () => this.message.set('Erreur lors de la génération du rapport responsable de salle')
    });
  }

  private declencherTelechargement(blob: Blob, nom: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
