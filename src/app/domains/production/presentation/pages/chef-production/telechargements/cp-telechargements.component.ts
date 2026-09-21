import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProductionService, RapportHebdomadaireProductionBE, ClassementMachinisteBE, ClassementExecuteurBE, PPHBE
} from '../../../../infrastructure/production.service';

/**
 * TÉLÉCHARGEMENTS — Chef de Production
 * Rapports de lots (fichier serveur réel), rapport hebdomadaire / pertes /
 * performances / PPH / statistiques / historique (générés côté client à
 * partir de données réelles, faute d'endpoint d'export dédié pour chacun).
 * Bons de Commande : non disponible (aucune entité BC côté backend).
 */
@Component({
  selector: 'app-cp-telechargements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cp-telechargements.component.html',
  styleUrls: ['./cp-telechargements.component.css', '../_shared.css']
})
export class CpTelechargementsComponent {
  private readonly svc = inject(ProductionService);

  message = signal('');
  debut = signal(this.joursAvant(7));
  fin = signal(new Date().toISOString().split('T')[0]);
  formatLots: 'xlsx' | 'pdf' | 'csv' = 'xlsx';

  private joursAvant(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

  telechargerRapportLots(): void {
    this.svc.getRapportLots(this.debut(), this.fin(), this.formatLots).subscribe({
      next: blob => this.declencher(blob, `rapport-lots-${this.debut()}-${this.fin()}.${this.formatLots}`),
      error: () => this.message.set('Erreur lors du téléchargement du rapport des lots')
    });
  }

  telechargerRapportHebdomadaire(): void {
    this.svc.getRapportHebdomadaireProduction(this.debut(), this.fin()).subscribe({
      next: r => this.exporterJsonCommeCsv('rapport-hebdomadaire', {
        'Total quantité (kg)': r.totalQuantiteLots, 'Fûts nets': r.totalFutsNets, 'Taux pertes global (%)': r.tauxPertesGlobal,
        'Lots validés': r.totalLotsValides, 'Sessions broyage': r.nbSessionsBroyage, 'Sessions dosage': r.nbSessionsDosage, 'Fiches': r.nbFiches,
      }),
      error: () => this.message.set('Erreur lors de la génération du rapport hebdomadaire')
    });
  }

  telechargerRapportPertes(): void {
    this.svc.getRapportHebdomadaireProduction(this.debut(), this.fin()).subscribe({
      next: r => {
        const lignes = Object.entries(r.pertesParTypePoudre).map(([type, kg]) => ({ Type: type, 'Pertes (kg)': kg, '% pertes': r.pctPertesParTypePoudre[type] ?? 0 }));
        this.exporterTableauCsv('rapport-pertes', lignes);
      },
      error: () => this.message.set('Erreur lors de la génération du rapport des pertes')
    });
  }

  telechargerRapportPerformances(): void {
    this.svc.getClassementMachinistes(this.debut(), this.fin()).subscribe({
      next: (c: ClassementMachinisteBE) => this.exporterTableauCsv('rapport-performances-machinistes',
        c.classements.map(x => ({ Rang: x.rang, Machiniste: x.nomMachiniste, 'Productivité (kg)': x.productiviteKg, 'Taux (%)': x.tauxRealisationMoyen, 'Efficacité (%)': x.efficacite }))),
      error: () => this.message.set('Erreur lors de la génération du rapport de performances')
    });
    this.svc.getClassementExecuteurs(this.debut(), this.fin()).subscribe({
      next: (c: ClassementExecuteurBE[]) => this.exporterTableauCsv('rapport-performances-postes',
        c.map(x => ({ Rang: x.rang, Employé: x.nomEmploye, Quantité: x.quantiteTotaleRealisee, 'Taux (%)': x.tauxRealisationMoyen }))),
    });
  }

  telechargerPph(): void {
    this.svc.getPPHs().subscribe({
      next: (pphs: PPHBE[]) => this.exporterTableauCsv('plans-production-pph',
        pphs.map(p => ({ Référence: p.referencePPH, BC: p.referenceBC ?? '—', Semaine: p.semaine, Statut: p.statut, Début: p.dateDebut, Fin: p.dateFin }))),
      error: () => this.message.set('Erreur lors de l\'export des PPH')
    });
  }

  private exporterJsonCommeCsv(nom: string, data: Record<string, number>): void {
    const csv = ['Indicateur;Valeur', ...Object.entries(data).map(([k, v]) => `${k};${v}`)].join('\n');
    this.declencher(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), `${nom}-${this.debut()}-${this.fin()}.csv`);
  }

  private exporterTableauCsv(nom: string, lignes: Record<string, string | number>[]): void {
    if (!lignes.length) { this.message.set('Aucune donnée à exporter pour cette période'); return; }
    const entetes = Object.keys(lignes[0]);
    const csv = [entetes.join(';'), ...lignes.map(l => entetes.map(e => l[e]).join(';'))].join('\n');
    this.declencher(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), `${nom}-${this.debut()}-${this.fin()}.csv`);
  }

  private declencher(blob: Blob, nom: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nom; a.click();
    window.URL.revokeObjectURL(url);
  }
}
