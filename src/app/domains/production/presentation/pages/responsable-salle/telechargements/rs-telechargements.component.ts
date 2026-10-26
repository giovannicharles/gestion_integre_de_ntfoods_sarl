import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, ClassementExecuteurBE, RapportHebdoAffectationBE, PerformancePosteBE } from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type Telechargement = '' | 'registre' | 'rapport' | 'classement' | 'performances';

/**
 * TÉLÉCHARGEMENTS — Responsable de Salle.
 * Registre, rapport de période, classement des employés et performances des postes, en CSV généré côté client
 * à partir des données réelles : aucun export serveur dédié n'existe pour ces documents (seul le registre de
 * dosage en a un, sur sa propre page). Le rapport et le classement reprennent les valeurs déjà corrigées
 * (#96, #98, #99, #105) ; les champs ajoutés en #105 (fûts produits et cassés) sont inclus dans l'export.
 */
@Component({
  selector: 'app-rs-telechargements',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './rs-telechargements.component.html',
  styleUrls: ['./rs-telechargements.component.css'],
})
export class RsTelechargementsComponent {
  private readonly svc = inject(ProductionService);

  readonly debut = signal(dateLocaleIso(this.joursAvant(7)));
  readonly fin = signal(dateLocaleIso());

  readonly enCours = signal<Telechargement>('');
  readonly message = signal('');
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);

  private joursAvant(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  periodeValide(): boolean {
    return this.fin() >= this.debut();
  }

  telechargerRegistre(): void {
    if (!this.verifierPeriode()) return;
    this.lancer('registre');
    this.svc.getRegistres({ debut: this.debut(), fin: this.fin() }).subscribe({
      next: registres => {
        const lignes = registres.flatMap(r => r.lignes.map(l => ({
          Date: r.date, PPH: r.referencePPH, Employé: l.nomEmploye, Matricule: l.matriculeEmploye,
          Poste: l.poste, Présent: l.present ? 'Oui' : 'Non', 'Motif absence': l.motifAbsence ?? '',
          'Heure arrivée': l.heureArrivee ?? '', Quantité: l.qteRealisee, Unité: l.unite ?? '',
        })));
        this.terminer('registre-journalier', lignes);
      },
      error: e => this.echouer(e, 'Le registre n\'a pas pu être exporté.'),
    });
  }

  telechargerRapportHebdo(): void {
    if (!this.verifierPeriode()) return;
    this.lancer('rapport');
    this.svc.getRapportHebdomadaireAffectation(this.debut(), this.fin()).subscribe({
      next: (r: RapportHebdoAffectationBE) => {
        this.terminer('rapport-periode-atelier', [{
          Période: `${this.debut()} au ${this.fin()}`,
          'Fûts nets': r.nbFutsNets, 'Poids poudre dosée (kg)': r.poidsTotalPoudreKg,
          'Production réalisée (kg, postes en kg)': r.productionTotaleKg,
          'Sessions de dosage': r.nbSessionsDosage, 'Jours affectés': r.nbJoursAffectes,
        }]);
      },
      error: e => this.echouer(e, 'Le rapport n\'a pas pu être exporté.'),
    });
  }

  telechargerClassementEmployes(): void {
    if (!this.verifierPeriode()) return;
    this.lancer('classement');
    this.svc.getClassementExecuteurs(this.debut(), this.fin()).subscribe({
      next: (c: ClassementExecuteurBE[]) => this.terminer('classement-employes', c.map(x => ({
        Rang: x.rang, Employé: x.nomEmploye, Matricule: x.matriculeEmploye,
        'Taux individuel (%)': x.tauxRealisationMoyen, 'Jours travaillés': x.nbJoursAffectes,
        'Quantité (unité principale)': x.quantiteTotaleRealisee, 'Unité principale': x.unite,
        'Détail par unité': (x.quantitesParUnite ?? []).map(q => `${q.quantite} ${q.unite}`).join(' / '),
      }))),
      error: e => this.echouer(e, 'Le classement n\'a pas pu être exporté.'),
    });
  }

  telechargerPerformancesPostes(): void {
    if (!this.verifierPeriode()) return;
    this.lancer('performances');
    this.svc.getPerformancesPostes(this.debut(), this.fin()).subscribe({
      next: (p: PerformancePosteBE[]) => this.terminer('performances-postes', p.map(x => ({
        Rang: x.rang ?? '', Poste: x.libelle, 'Jours affectés': x.joursAffectes, 'Jours saisis': x.joursSaisis,
        Objectif: x.objectifTotal, Réalisé: x.realiseTotal, Unité: x.unite,
        'Taux (%)': x.tauxRealisation, 'Effectif moyen': x.effectifMoyen, 'Par personne': x.rendementParPersonne,
      }))),
      error: e => this.echouer(e, 'Les performances des postes n\'ont pas pu être exportées.'),
    });
  }

  private verifierPeriode(): boolean {
    this.erreur.set('');
    if (!this.periodeValide()) {
      this.erreur.set('La date de fin précède la date de début.');
      return false;
    }
    return true;
  }

  private lancer(cle: Telechargement): void {
    this.enCours.set(cle);
    this.message.set('');
    this.erreur.set('');
    this.sessionExpiree.set(false);
  }

  private terminer(nom: string, lignes: Record<string, string | number>[]): void {
    this.enCours.set('');
    if (!lignes.length) {
      this.message.set('Aucune donnée à exporter pour cette période.');
      return;
    }
    this.exporterCsv(nom, lignes);
    this.message.set(`Téléchargement lancé : ${lignes.length} ligne(s).`);
  }

  private echouer(e: unknown, repli: string): void {
    this.enCours.set('');
    const err = e as { status?: number; error?: { erreur?: string; message?: string } };
    if (err?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    this.erreur.set(err?.error?.erreur || err?.error?.message || repli);
  }

  private exporterCsv(nom: string, lignes: Record<string, string | number>[]): void {
    const entetes = Object.keys(lignes[0]);
    const echapper = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [entetes.map(echapper).join(';'), ...lignes.map(l => entetes.map(e => echapper(l[e])).join(';'))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nom}-${this.debut()}-${this.fin()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
