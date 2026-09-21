import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, RegistreProductionBE, PPHBE } from '../../../../infrastructure/production.service';

/**
 * REGISTRE JOURNALIER DES EMPLOYÉS — Responsable de Salle
 * GET /registres (réel, autorisé) — recherche, filtres, téléchargement.
 *
 * ⚠️ Le téléchargement PDF/Excel n'a pas d'endpoint dédié pour le registre
 * (contrairement au registre de dosage) — génération CSV côté client à
 * partir des données réelles.
 */
@Component({
  selector: 'app-rs-registre-journalier',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './rs-registre-journalier.component.html',
  styleUrls: ['./rs-registre-journalier.component.css', '../_shared.css']
})
export class RsRegistreJournalierComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  registres = signal<RegistreProductionBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  recherche = signal('');
  debut = signal(this.joursAvant(14));
  fin = signal(new Date().toISOString().split('T')[0]);

  lignesAplaties = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    return this.registres().flatMap(reg => reg.lignes.map(l => ({ ...l, date: reg.date, referencePPH: reg.referencePPH })))
      .filter(l => !r || l.nomEmploye.toLowerCase().includes(r) || l.matriculeEmploye.toLowerCase().includes(r));
  });

  private joursAvant(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getRegistres({ debut: this.debut(), fin: this.fin() }).subscribe({
      next: r => { this.registres.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  exporterCsv(): void {
    const lignes = this.lignesAplaties();
    const entetes = ['Date', 'PPH', 'Employé', 'Matricule', 'Poste', 'Présent', 'Quantité produite'];
    const rows = lignes.map(l => [l.date, l.referencePPH, l.nomEmploye, l.matriculeEmploye, l.poste, l.present ? 'Oui' : 'Non', l.qteRealisee]);
    const csv = [entetes, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `registre-journalier-${this.debut()}-${this.fin()}.csv`; a.click();
    window.URL.revokeObjectURL(url);
  }
}
