import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RpService, RpDashboard, PrimeResponse, GrandCompteResponse, OccupationMarcheResponse, PerformanceGammeResponse, GrandCompteRequest } from '../../../infrastructure/rp.service';
import { CommercialService } from '../../../../commercial/infrastructure/commercial.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-rp-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule],
  templateUrl: './rp-dashboard.component.html',
  styleUrls: ['./rp-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RpDashboardComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;
  Math = Math;

  private readonly svc = inject(RpService);
  private readonly commercialSvc = inject(CommercialService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  savingGc = signal(false);

  data = signal<RpDashboard | null>(null);
  primes = signal<PrimeResponse[]>([]);
  gammes = signal<PerformanceGammeResponse[]>([]);
  occupation = signal<OccupationMarcheResponse[]>([]);
  grandsComptes = signal<GrandCompteResponse[]>([]);

  // Filtres et recherche
  activeTab = signal<'VUE_ENSEMBLE' | 'GRANDS_COMPTES' | 'GAMMES' | 'SECTEURS'>('VUE_ENSEMBLE');
  filtreTypeGc = signal<string>('TOUS');
  searchGc = signal<string>('');

  // Modal rapide nouveau Grand Compte
  showNouveauGcModal = signal(false);
  nouveauGc = signal<GrandCompteRequest>({
    nom: '',
    type: 'GMS',
    contact: '',
    telephone: '',
    caMensuel: 0,
    derniereCommande: null,
    prochaineRelance: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
    statut: 'ACTIF'
  });

  nbEligibles = computed(() => this.data()?.nbEligibles ?? this.primes().filter(p => p.eligible).length);
  totalPrimes = computed(() => this.data()?.totalPrimes ?? this.primes().filter(p => p.eligible).reduce((s, p) => s + p.montant, 0));
  occupationMoyenne = computed(() => {
    const list = this.occupation();
    if (!list.length) return this.data()?.occupationMoyenne ?? 0;
    const sum = list.reduce((acc, o) => acc + (o.repertoriees > 0 ? (o.livrees / o.repertoriees) * 100 : 0), 0);
    return Math.round(sum / list.length);
  });
  grandsComptesActifs = computed(() => this.grandsComptes().filter(g => g.statut === 'ACTIF').length);
  relancesDues = computed(() => this.grandsComptes().filter(g => g.statut === 'A_RELANCER' || (g.prochaineRelance && new Date(g.prochaineRelance) <= new Date())).length);
  caGrandsComptes = computed(() => this.grandsComptes().reduce((s, g) => s + (g.caMensuel || 0), 0));

  grandsComptesFiltres = computed(() => {
    let list = this.grandsComptes();
    const type = this.filtreTypeGc();
    const q = this.searchGc().trim().toLowerCase();
    if (type !== 'TOUS') {
      list = list.filter(g => g.type === type);
    }
    if (q) {
      list = list.filter(g =>
        g.nom.toLowerCase().includes(q) ||
        (g.contact && g.contact.toLowerCase().includes(q)) ||
        (g.telephone && g.telephone.includes(q))
      );
    }
    return list;
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getDashboard().subscribe({
      next: d => {
        this.data.set(d);
        this.primes.set(d.primes || []);
        this.gammes.set(d.gammes || []);
        this.occupation.set(d.occupation || []);
        this.grandsComptes.set(d.grandsComptes || []);

        // Si gammes ou primes est vide (primes hebdomadaires non encore calculées),
        // on tente de charger les primes auto depuis CommercialService
        if (!d.primes?.length || !d.gammes?.length) {
          this.chargerPrimesEtGammesFallback();
        } else {
          this.loading.set(false);
        }
      },
      error: e => {
        this.loadError.set(extractApiError(e));
        this.loading.set(false);
      },
    });
  }

  private chargerPrimesEtGammesFallback(): void {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const semaineDebut = monday.toISOString().substring(0, 10);
    const semaineFin = sunday.toISOString().substring(0, 10);

    this.commercialSvc.getPrimesHebdoAutomatique(semaineDebut, semaineFin).subscribe({
      next: res => {
        if (res?.length && !this.primes().length) {
          const mapped: PrimeResponse[] = res.map(r => ({
            commercialId: r.matriculeCommercial,
            nom: r.matriculeCommercial,
            tauxGlobal: Math.round(r.tauxGlobal),
            gammesValidees: r.gammesValidees?.length ?? 0,
            gammesTotal: (r.gammesValidees?.length ?? 0) + (r.gammesBloquantes?.length ?? 0),
            eligible: r.eligible,
            montant: r.montantPrime
          }));
          this.primes.set(mapped);
        }

        // Si les gammes sont toujours vides, alimenter avec les gammes TANTY officielles
        if (!this.gammes().length) {
          const gammesRef: PerformanceGammeResponse[] = [
            { gamme: 'Tapioca Sans Sable Tanty (1kg, 500g)', ca: 0, objectif: 5000000, marge: null, stock: null },
            { gamme: 'Bouillie Lion Infantile & Maternelle', ca: 0, objectif: 4200000, marge: null, stock: null },
            { gamme: 'Farine Composée de Maïs & Soja', ca: 0, objectif: 3500000, marge: null, stock: null },
            { gamme: 'Snacks & Amuse-Gueules Croustillants', ca: 0, objectif: 2000000, marge: null, stock: null },
            { gamme: 'Huile Végétale & Condiments Tanty', ca: 0, objectif: 2500000, marge: null, stock: null }
          ];

          // Si on a des calculs de gammes dans le résultat auto
          if (res?.length) {
            const cumulRealise: Record<string, number> = {};
            const cumulCible: Record<string, number> = {};
            for (const r of res) {
              if (r.tauxParGamme) {
                for (const [gName, val] of Object.entries(r.tauxParGamme)) {
                  const numVal = Number(val) || 0;
                  cumulRealise[gName] = (cumulRealise[gName] || 0) + (r.caRealise * (numVal / 100));
                  cumulCible[gName] = (cumulCible[gName] || 0) + r.caCible;
                }
              }
            }
            if (Object.keys(cumulCible).length > 0) {
              const dynGammes: PerformanceGammeResponse[] = Object.keys(cumulCible).map(k => ({
                gamme: k,
                ca: Math.round(cumulRealise[k] || 0),
                objectif: Math.round(cumulCible[k] || 1000000),
                marge: null,
                stock: null
              }));
              this.gammes.set(dynGammes);
              this.loading.set(false);
              return;
            }
          }
          this.gammes.set(gammesRef);
        }
        this.loading.set(false);
      },
      error: () => {
        // En cas d'erreur sur l'auto, initialiser les gammes de référence par défaut
        if (!this.gammes().length) {
          this.gammes.set([
            { gamme: 'Tapioca Sans Sable Tanty', ca: 0, objectif: 5000000, marge: null, stock: null },
            { gamme: 'Bouillie Infantile & Farines', ca: 0, objectif: 4200000, marge: null, stock: null },
            { gamme: 'Soja & Farines Composées', ca: 0, objectif: 3000000, marge: null, stock: null },
            { gamme: 'Snacks & Produits Spéciaux', ca: 0, objectif: 2000000, marge: null, stock: null }
          ]);
        }
        this.loading.set(false);
      }
    });
  }

  ouvrirModalNouveauGc(): void {
    this.nouveauGc.set({
      nom: '',
      type: 'GMS',
      contact: '',
      telephone: '',
      caMensuel: 0,
      derniereCommande: null,
      prochaineRelance: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      statut: 'ACTIF'
    });
    this.showNouveauGcModal.set(true);
  }

  fermerModalNouveauGc(): void {
    this.showNouveauGcModal.set(false);
  }

  enregistrerNouveauGc(): void {
    const gc = this.nouveauGc();
    if (!gc.nom.trim()) {
      this.toast.error('Veuillez renseigner le nom de l\'enseigne ou du partenaire.');
      return;
    }
    this.savingGc.set(true);
    this.svc.creerGrandCompte(gc).subscribe({
      next: cree => {
        this.savingGc.set(false);
        this.showNouveauGcModal.set(false);
        this.grandsComptes.update(list => [cree, ...list]);
        this.toast.success(`Grand Compte « ${cree.nom} » enregistré avec succès.`);
      },
      error: err => {
        this.savingGc.set(false);
        this.toast.error(extractApiError(err));
      }
    });
  }

  imprimerRapport(): void {
    window.print();
  }

  tauxOccupation(o: { livrees: number; repertoriees: number }): number {
    if (!o.repertoriees || o.repertoriees <= 0) return 0;
    return Math.round((o.livrees / o.repertoriees) * 100);
  }
}
