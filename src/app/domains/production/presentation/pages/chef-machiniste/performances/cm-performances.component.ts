import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, ClassementMachinisteBE } from '../../../../infrastructure/production.service';

/**
 * CONSULTATION DES PERFORMANCES — Chef Machiniste
 * Pour chaque machiniste : quantité produite, objectif, taux de réalisation,
 * efficacité, productivité. Recherche + filtres période + pagination + export CSV.
 */
@Component({
  selector: 'app-cm-performances',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './cm-performances.component.html',
  styleUrls: ['./cm-performances.component.css', '../_shared.css']
})
export class CmPerformancesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  error = signal('');
  classement = signal<ClassementMachinisteBE | null>(null);

  debut = signal(this.joursAvant(7));
  fin = signal(new Date().toISOString().split('T')[0]);
  recherche = signal('');

  page = signal(1);
  readonly pageSize = 8;

  private joursAvant(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  lignesFiltrees = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    const list = this.classement()?.classements ?? [];
    return r ? list.filter(c => c.nomMachiniste.toLowerCase().includes(r) || c.machinisteMatricule.toLowerCase().includes(r)) : list;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.lignesFiltrees().length / this.pageSize)));
  lignesPage = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.lignesFiltrees().slice(start, start + this.pageSize);
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    this.svc.getClassementMachinistes(this.debut(), this.fin()).subscribe({
      next: c => { this.classement.set(c); this.page.set(1); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors du chargement des performances'); this.loading.set(false); }
    });
  }

  allerPage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) this.page.set(p);
  }

  exporterCsv(): void {
    const lignes = this.lignesFiltrees();
    const entetes = ['Rang', 'Matricule', 'Nom', 'Quantité produite (kg)', 'Objectif (kg)', 'Taux réalisation (%)', 'Efficacité (%)', 'Jours'];
    const rows = lignes.map(c => [c.rang, c.machinisteMatricule, c.nomMachiniste, c.productiviteKg, c.objectifTotalKg, c.tauxRealisationMoyen, c.efficacite, c.nbJours]);
    const csv = [entetes, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performances-machinistes-${this.debut()}-${this.fin()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
