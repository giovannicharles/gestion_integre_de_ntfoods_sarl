import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionBroyageBE, ClassementMachinisteBE } from '../../../../infrastructure/production.service';

type TypeRapport = 'journalier' | 'hebdomadaire' | 'mensuel' | 'pertes' | 'performances' | 'objectifs' | 'realisations';

/**
 * RAPPORTS — Chef Machiniste
 *
 * ⚠️ Limite backend : `RapportProductionController` (endpoints /rapports/*)
 * n'autorise QUE CHEF_PRODUCTION / RESPONSABLE_SALLE / DIRECTEUR_GENERAL / ADMIN
 * (vérifié dans les @PreAuthorize du contrôleur) — le rôle CHEF_MACHINISTE n'y a
 * pas accès. Les rapports ci-dessous sont donc générés côté client (CSV / impression)
 * à partir des données réellement autorisées pour ce rôle (`/broyage/*`), et non
 * via un export PDF/Excel serveur qui renverrait une erreur 403.
 */
@Component({
  selector: 'app-cm-rapports',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './cm-rapports.component.html',
  styleUrls: ['./cm-rapports.component.css', '../_shared.css']
})
export class CmRapportsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(false);
  message = signal('');

  debut = signal(this.joursAvant(7));
  fin = signal(new Date().toISOString().split('T')[0]);

  rapports: { type: TypeRapport; icone: string; titre: string; description: string }[] = [
    { type: 'journalier', icone: 'fa-calendar-day', titre: 'Production journalière', description: 'Sessions du jour : objectifs, réalisations, pertes' },
    { type: 'hebdomadaire', icone: 'fa-calendar-week', titre: 'Production hebdomadaire', description: 'Synthèse de la période sélectionnée' },
    { type: 'mensuel', icone: 'fa-calendar-days', titre: 'Production mensuelle', description: 'Synthèse sur 30 jours' },
    { type: 'pertes', icone: 'fa-triangle-exclamation', titre: 'Rapport des pertes', description: 'Détail des pertes par session et par type de poudre' },
    { type: 'performances', icone: 'fa-chart-simple', titre: 'Rapport des performances', description: 'Classement machinistes sur la période' },
    { type: 'objectifs', icone: 'fa-bullseye', titre: 'Rapport des objectifs', description: 'Objectifs fixés par machiniste et par poste' },
    { type: 'realisations', icone: 'fa-list-check', titre: 'Rapport des réalisations', description: 'Détail des réalisations enregistrées' },
  ];

  private joursAvant(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  ngOnInit(): void {}

  telecharger(type: TypeRapport, format: 'csv' | 'print'): void {
    this.loading.set(true);
    this.message.set('');
    let debut = this.debut(); const fin = this.fin();
    if (type === 'journalier') debut = fin;
    if (type === 'mensuel') debut = this.joursAvant(30);

    this.svc.getSessionsBroyage({ debut, fin }).subscribe({
      next: sessions => {
        if (type === 'performances' || type === 'objectifs') {
          this.svc.getClassementMachinistes(debut, fin).subscribe({
            next: classement => this.generer(type, format, sessions, classement, debut, fin),
            error: () => { this.message.set('Erreur lors de la génération du rapport'); this.loading.set(false); }
          });
        } else {
          this.generer(type, format, sessions, null, debut, fin);
        }
      },
      error: () => { this.message.set('Erreur lors de la génération du rapport'); this.loading.set(false); }
    });
  }

  private generer(type: TypeRapport, format: 'csv' | 'print', sessions: SessionBroyageBE[], classement: ClassementMachinisteBE | null, debut: string, fin: string): void {
    const nomFichier = `rapport-${type}-${debut}-${fin}`;
    if (format === 'csv') {
      this.exporterCsv(type, sessions, classement, nomFichier);
    } else {
      this.imprimer(type, sessions, classement, debut, fin);
    }
    this.loading.set(false);
  }

  private exporterCsv(type: TypeRapport, sessions: SessionBroyageBE[], classement: ClassementMachinisteBE | null, nomFichier: string): void {
    let entetes: string[] = []; let rows: (string | number)[][] = [];
    if (type === 'performances' && classement) {
      entetes = ['Rang', 'Machiniste', 'Productivité (kg)', 'Objectif (kg)', 'Taux (%)', 'Efficacité (%)'];
      rows = classement.classements.map(c => [c.rang, c.nomMachiniste, c.productiviteKg, c.objectifTotalKg, c.tauxRealisationMoyen, c.efficacite]);
    } else if (type === 'objectifs' && classement) {
      entetes = ['Machiniste', 'Opérations', 'Jours', 'Objectif total (kg)'];
      rows = classement.classements.map(c => [c.nomMachiniste, c.operations.join(' / '), c.nbJours, c.objectifTotalKg]);
    } else if (type === 'pertes') {
      entetes = ['Date', 'PPH', 'Type poudre', 'Pertes (kg)', '% pertes'];
      rows = sessions.map(s => [s.date, s.referencePPH, s.typePoudreLibelle, s.pertesKg ?? 0, s.pctPertes ?? 0]);
    } else {
      entetes = ['Date', 'PPH', 'Type poudre', 'Objectif (kg)', 'Nette broyée (kg)', 'Pertes (kg)', 'Statut'];
      rows = sessions.map(s => [s.date, s.referencePPH, s.typePoudreLibelle, s.objectifJournalierKg, s.quantiteNetteBroyeeKg ?? 0, s.pertesKg ?? 0, s.statut]);
    }
    const csv = [entetes, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${nomFichier}.csv`; a.click();
    window.URL.revokeObjectURL(url);
  }

  private imprimer(type: TypeRapport, sessions: SessionBroyageBE[], classement: ClassementMachinisteBE | null, debut: string, fin: string): void {
    const w = window.open('', '_blank');
    if (!w) { this.message.set('Veuillez autoriser les pop-ups pour imprimer / exporter en PDF'); return; }
    const lignesSessions = sessions.map(s => `<tr><td>${s.date}</td><td>${s.referencePPH}</td><td>${s.typePoudreLibelle}</td><td>${s.objectifJournalierKg}</td><td>${s.quantiteNetteBroyeeKg ?? 0}</td><td>${s.pertesKg ?? 0}</td><td>${s.statut}</td></tr>`).join('');
    const lignesClassement = classement ? classement.classements.map(c => `<tr><td>#${c.rang}</td><td>${c.nomMachiniste}</td><td>${c.productiviteKg}</td><td>${c.tauxRealisationMoyen}%</td></tr>`).join('') : '';
    w.document.write(`
      <html><head><title>${type} — ${debut} au ${fin}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px} h1{font-size:18px} table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #ccc;padding:6px;font-size:12px;text-align:left}</style>
      </head><body>
      <h1>Rapport ${type} — Chef Machiniste</h1>
      <p>Période : ${debut} au ${fin}</p>
      ${sessions.length ? `<table><thead><tr><th>Date</th><th>PPH</th><th>Type</th><th>Objectif</th><th>Nette broyée</th><th>Pertes</th><th>Statut</th></tr></thead><tbody>${lignesSessions}</tbody></table>` : ''}
      ${classement ? `<table><thead><tr><th>Rang</th><th>Machiniste</th><th>Productivité</th><th>Taux</th></tr></thead><tbody>${lignesClassement}</tbody></table>` : ''}
      </body></html>
    `);
    w.document.close();
    w.print();
  }
}
