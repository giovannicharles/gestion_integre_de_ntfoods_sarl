import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DgService, ClassementCommercialBE } from '../../../infrastructure/dg.service';
import { ComptableService, PrimeSemaineBE } from '../../../../comptable/infrastructure/comptable.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

interface LigneClassement extends ClassementCommercialBE {
  objectifFCFA: number;
  tauxReelPourcent: number;
  eligible: boolean;
  montantPrimeFCFA: number;
}

/**
 * Réécrit le 2026-10-16 — l'écran mélangeait deux notions différentes sous un seul
 * calcul client : le classement (qui a le plus vendu CETTE semaine, relatif aux
 * pairs) et l'éligibilité à la prime (règle 80/75 appliquée à l'objectif INDIVIDUEL
 * de chaque commercial, calculée et tracée par le serveur — PrimeSemaineBE). Le
 * code précédent déclarait éligible le premier du classement par volume, affichait
 * un montant de prime forfaitaire (12 000, codé en dur) identique pour tous, et la
 * colonne « Objectif » affichait toujours « — » faute de donnée réelle chargée — le
 * total équipe divisait même le CA par le NOMBRE de commerciaux et l'affichait
 * comme si c'était un montant en FCFA. Toutes les données viennent maintenant du
 * même calcul serveur que l'écran Objectifs (ComptableService.getPrimesParSemaine).
 */
@Component({
  selector: 'app-dg-classement',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule],
  templateUrl: './dg-classement.component.html',
  styleUrls: ['./dg-classement.component.css']
})
export class DgClassementComponent implements OnInit {
  today = new Date();
  private readonly dgSvc = inject(DgService);
  private readonly cptSvc = inject(ComptableService);

  loading = signal(true);
  loadError = signal<string | null>(null);

  selectedSemaine = signal(this.lundiCourant());
  semaines = this.dernieresSemaines(6);

  lignes = signal<LigneClassement[]>([]);
  primesTotal = computed(() => this.lignes().filter(c => c.eligible).reduce((s, c) => s + c.montantPrimeFCFA, 0));
  nbEligibles = computed(() => this.lignes().filter(c => c.eligible).length);
  totalCaEquipe = computed(() => this.lignes().reduce((s, c) => s + c.caRealise, 0));
  totalObjectifEquipe = computed(() => this.lignes().reduce((s, c) => s + c.objectifFCFA, 0));

  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      classement: this.dgSvc.getClassement(),
      primes: this.cptSvc.getPrimesParSemaine(this.selectedSemaine()),
    }).subscribe({
      next: ({ classement, primes }) => {
        const primeParMatricule = new Map<string, PrimeSemaineBE>(primes.map(p => [p.matriculeCommercial, p]));
        this.lignes.set(classement.map(c => {
          const p = primeParMatricule.get(c.matricule);
          return {
            ...c,
            objectifFCFA: p?.objectifGlobalFCFA ?? 0,
            tauxReelPourcent: p?.tauxRealisationGlobalPourcent ?? 0,
            eligible: p?.eligible ?? false,
            montantPrimeFCFA: p?.montantPrimeFCFA ?? 0,
          };
        }));
        this.loading.set(false);
      },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  changerSemaine(valeur: string): void {
    this.selectedSemaine.set(valeur);
    this.charger();
  }

  cappedTaux(pct: number): number { return Math.min(pct, 100); }

  private lundiCourant(): string {
    const now = new Date();
    const decalage = (now.getDay() + 6) % 7;
    const lundi = new Date(now);
    lundi.setDate(now.getDate() - decalage);
    return this.fmt(lundi);
  }

  private dernieresSemaines(n: number): string[] {
    const semaines: string[] = [];
    const lundi = new Date(this.lundiCourant());
    for (let i = 0; i < n; i++) {
      const d = new Date(lundi);
      d.setDate(lundi.getDate() - 7 * i);
      semaines.push(this.fmt(d));
    }
    return semaines;
  }

  private fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
