import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, RegistreProductionBE, LigneRegistreBE, PPHBE, CodePosteRef, CODES_POSTE } from '../../../../infrastructure/production.service';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';

/**
 * REGISTRE JOURNALIER DES EMPLOYÉS — Responsable de Salle
 * GET /registres (réel, autorisé) — recherche, filtres, téléchargement.
 * Correction du registre d'aujourd'hui uniquement (PATCH) — au-delà, le registre
 * est définitif (preuve d'audit), le serveur refuse en 409.
 *
 * ⚠️ Le téléchargement PDF/Excel n'a pas d'endpoint dédié pour le registre
 * (contrairement au registre de dosage) — génération CSV côté client à
 * partir des données réelles.
 */
@Component({
  selector: 'app-rs-registre-journalier',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, HasPermissionDirective],
  templateUrl: './rs-registre-journalier.component.html',
  styleUrls: ['./rs-registre-journalier.component.css', '../_shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RsRegistreJournalierComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  registres = signal<RegistreProductionBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  recherche = signal('');
  debut = signal(this.joursAvant(14));
  fin = signal(new Date().toISOString().split('T')[0]);

  modeCorrection = signal(false);
  lignesCorrection = signal<LigneRegistreBE[]>([]);
  enregistrementEnCours = signal(false);
  message = signal('');
  codesPoste = signal<CodePosteRef[]>(CODES_POSTE);

  readonly aujourdhui = this.dateLocaleIso();

  lignesAplaties = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    return this.registres().flatMap(reg => reg.lignes.map(l => ({ ...l, date: reg.date, referencePPH: reg.referencePPH })))
      .filter(l => !r || l.nomEmploye.toLowerCase().includes(r) || l.matriculeEmploye.toLowerCase().includes(r));
  });

  /** Registre du jour, visible seulement s'il est chargé dans la période affichée. */
  registreAujourdhui = computed(() => this.registres().find(r => r.date === this.aujourdhui) ?? null);

  private dateLocaleIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private joursAvant(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

  ngOnInit(): void {
    this.charger();
    this.svc.getPostesProduction().subscribe({
      next: p => this.codesPoste.set(p.length > 0 ? p : CODES_POSTE),
      error: () => this.codesPoste.set(CODES_POSTE)
    });
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getRegistres({ debut: this.debut(), fin: this.fin() }).subscribe({
      next: r => { this.registres.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  demarrerCorrection(): void {
    const r = this.registreAujourdhui();
    if (!r) return;
    this.lignesCorrection.set(r.lignes.map(l => ({ ...l })));
    this.modeCorrection.set(true);
    this.message.set('');
  }

  annulerCorrection(): void {
    this.modeCorrection.set(false);
    this.lignesCorrection.set([]);
  }

  ajouterLigneCorrection(): void {
    this.lignesCorrection.update(l => [...l, {
      matriculeEmploye: '', nomEmploye: '', poste: '', present: true,
      motifAbsence: null, heureArrivee: null, qteRealisee: 0, unite: null
    }]);
  }

  retirerLigneCorrection(index: number): void {
    this.lignesCorrection.update(l => l.filter((_, i) => i !== index));
  }

  enregistrerCorrection(): void {
    const r = this.registreAujourdhui();
    if (!r) return;
    const lignes = this.lignesCorrection().filter(l => l.matriculeEmploye.trim() && l.nomEmploye.trim() && l.poste.trim());
    if (lignes.length === 0) {
      this.message.set('Au moins un employé avec un poste est requis');
      return;
    }
    this.enregistrementEnCours.set(true);
    const lignesEnvoyees = lignes.map(l => ({
      matriculeEmploye: l.matriculeEmploye, nomEmploye: l.nomEmploye, poste: l.poste, present: l.present,
      motifAbsence: l.motifAbsence ?? undefined, heureArrivee: l.heureArrivee ?? undefined,
      qteRealisee: l.qteRealisee ?? undefined, unite: l.unite ?? undefined,
    }));
    this.svc.modifierRegistre(r.referencePPH, r.date, { lignes: lignesEnvoyees }).subscribe({
      next: corrige => {
        this.registres.update(list => list.map(x => (x.id === corrige.id ? corrige : x)));
        this.modeCorrection.set(false);
        this.enregistrementEnCours.set(false);
        this.message.set('Registre corrigé');
      },
      error: (err) => {
        this.enregistrementEnCours.set(false);
        this.message.set(err?.status === 409
          ? 'Ce registre ne peut plus être corrigé (jour passé)'
          : 'Erreur lors de la correction du registre');
      }
    });
  }

  exporterCsv(): void {
    const lignes = this.lignesAplaties();
    const entetes = ['Date', 'PPH', 'Employé', 'Matricule', 'Poste', 'Présent', 'Quantité produite'];
    const rows = lignes.map(l => [l.date, l.referencePPH, l.nomEmploye, l.matriculeEmploye, l.poste, l.present ? 'Oui' : 'Non', l.qteRealisee]);
    const csv = [entetes, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `registre-journalier-${this.debut()}-${this.fin()}.csv`; a.click();
    window.URL.revokeObjectURL(url);
  }
}
