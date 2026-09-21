import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, ClassementExecuteurBE, RapportHebdoAffectationBE } from '../../../../infrastructure/production.service';

/**
 * TÉLÉCHARGEMENTS — Responsable de Salle
 * Registre, rapport hebdomadaire, classements — générés en CSV côté client
 * (aucun export serveur dédié pour ces données autres que le rapport lots).
 */
@Component({
  selector: 'app-rs-telechargements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rs-telechargements.component.html',
  styleUrls: ['./rs-telechargements.component.css', '../_shared.css']
})
export class RsTelechargementsComponent {
  private readonly svc = inject(ProductionService);

  message = signal('');
  debut = signal(this.joursAvant(7));
  fin = signal(new Date().toISOString().split('T')[0]);

  private joursAvant(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

  telechargerRegistre(): void {
    this.svc.getRegistres({ debut: this.debut(), fin: this.fin() }).subscribe({
      next: registres => {
        const lignes = registres.flatMap(r => r.lignes.map(l => ({ Date: r.date, PPH: r.referencePPH, Employé: l.nomEmploye, Poste: l.poste, Présent: l.present ? 'Oui' : 'Non', Quantité: l.qteRealisee })));
        this.exporterCsv('registre-journalier', lignes);
      },
      error: () => this.message.set('Erreur lors de l\'export du registre')
    });
  }

  telechargerRapportHebdo(): void {
    this.svc.getRapportHebdomadaireAffectation(this.debut(), this.fin()).subscribe({
      next: (r: RapportHebdoAffectationBE) => this.exporterCsv('rapport-hebdomadaire-atelier', [{
        Période: r.periodeLibelle, 'Fûts nets': r.nbFutsNets, 'Poids poudre (kg)': r.poidsTotalPoudreKg,
        'Production totale (kg)': r.productionTotaleKg, 'Sessions dosage': r.nbSessionsDosage, 'Jours affectés': r.nbJoursAffectes,
      }]),
      error: () => this.message.set('Erreur lors de l\'export du rapport')
    });
  }

  telechargerClassementEmployes(): void {
    this.svc.getClassementExecuteurs(this.debut(), this.fin()).subscribe({
      next: (c: ClassementExecuteurBE[]) => this.exporterCsv('classement-employes',
        c.map(x => ({ Rang: x.rang, Employé: x.nomEmploye, Quantité: x.quantiteTotaleRealisee, 'Taux (%)': x.tauxRealisationMoyen, Jours: x.nbJoursAffectes }))),
      error: () => this.message.set('Erreur lors de l\'export du classement')
    });
  }

  private exporterCsv(nom: string, lignes: Record<string, string | number>[]): void {
    if (!lignes.length) { this.message.set('Aucune donnée à exporter pour cette période'); return; }
    const entetes = Object.keys(lignes[0]);
    const csv = [entetes.join(';'), ...lignes.map(l => entetes.map(e => l[e]).join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${nom}-${this.debut()}-${this.fin()}.csv`; a.click();
    window.URL.revokeObjectURL(url);
  }
}
