import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import {
  ProductionService, RapportHebdomadaireProductionBE, PPHBE, OFBE, RegistreProductionBE,
  AffectationBE, SessionBroyageBE, SessionDosageBE, ExpressionBesoinBE, ClassementMachinisteBE,
  ClassementExecuteurBE
} from '../../../../infrastructure/production.service';
import { StockService, BonCommandeBE } from '../../../../../stock/infrastructure/stock.service';

type Categorie = 'Production' | 'Équipes' | 'Plans et commandes' | 'Journées';
type Ligne = Record<string, string | number | boolean | null | undefined>;
type Format = 'xlsx' | 'pdf' | 'csv' | 'json';

interface DocumentDef {
  code: string;
  titre: string;
  description: string;
  categorie: Categorie;
  icone: string;
  /** Fichier produit par le serveur (lots) ou assemblé ici en CSV. */
  serveur: boolean;
}

/** Date au format yyyy-mm-dd en heure locale. */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Valeur CSV : nombres au format français, guillemets si nécessaire. */
function cellule(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(lignes: Ligne[]): string {
  const colonnes = Object.keys(lignes[0]);
  return [colonnes.join(';'), ...lignes.map(l => colonnes.map(c => cellule(l[c])).join(';'))].join('\r\n');
}

const DOCUMENTS: DocumentDef[] = [
  { code: 'lots', titre: 'Rapport des lots', description: 'Lots déclarés sur la période, avec leur statut et leur validation par le stock.', categorie: 'Production', icone: 'fa-boxes-packing', serveur: true },
  { code: 'bilan', titre: 'Bilan de production', description: 'Indicateurs de la période, production par référence, avancement des BC et broyage par poudre.', categorie: 'Production', icone: 'fa-chart-column', serveur: false },
  { code: 'pertes', titre: 'Pertes de broyage', description: 'Quantités broyées, pertes et taux de pertes par type de poudre.', categorie: 'Production', icone: 'fa-triangle-exclamation', serveur: false },
  { code: 'of', titre: 'Ordres de fabrication', description: 'Tous les OF : quantités demandées et réalisées, échéance et statut.', categorie: 'Production', icone: 'fa-industry', serveur: false },
  { code: 'machinistes', titre: 'Performances des machinistes', description: 'Classement par productivité, objectif, taux de réalisation et efficacité.', categorie: 'Équipes', icone: 'fa-gears', serveur: false },
  { code: 'postes', titre: 'Performances des postes', description: 'Classement des employés par quantité réalisée et taux de réalisation.', categorie: 'Équipes', icone: 'fa-user-gear', serveur: false },
  { code: 'registres', titre: 'Registre des employés', description: 'Présences, arrivées et réalisations de chaque employé, jour par jour.', categorie: 'Équipes', icone: 'fa-user-check', serveur: false },
  { code: 'affectations', titre: 'Affectations', description: 'Postes affectés chaque jour, effectifs de référence et réels, objectifs ajustés.', categorie: 'Équipes', icone: 'fa-users-gear', serveur: false },
  { code: 'pph', titre: 'Plans de production (PPH)', description: 'Une ligne par produit de chaque plan : objectif, réalisé, quantités attendues.', categorie: 'Plans et commandes', icone: 'fa-calendar-week', serveur: false },
  { code: 'bc', titre: 'Bons de commande', description: 'Chaque BC et ses lignes : quantités commandées, produites et taux de réalisation.', categorie: 'Plans et commandes', icone: 'fa-file-invoice', serveur: false },
  { code: 'besoins', titre: 'Expressions de besoin', description: 'Besoins signalés sur la période, avec leur décision et leur motif.', categorie: 'Plans et commandes', icone: 'fa-triangle-exclamation', serveur: false },
  { code: 'broyage', titre: 'Sessions de broyage', description: 'Sessions du jour : objectif, réalisé, pertes, validation et clôture.', categorie: 'Journées', icone: 'fa-gears', serveur: false },
  { code: 'dosage', titre: 'Sessions de dosage', description: 'Sessions : fûts produits, nets et cassés, machines, pauses et clôtures.', categorie: 'Journées', icone: 'fa-fill-drip', serveur: false },
];

/**
 * TÉLÉCHARGEMENTS — Chef de Production.
 * Chaque document est produit à partir des données de la période choisie. Le rapport des lots
 * est un fichier du serveur ; les autres sont des CSV (séparateur « ; », nombres à la française),
 * prêts pour Excel. Un document sans donnée n'est pas téléchargé : la page le signale.
 */
@Component({
  selector: 'app-cp-telechargements',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './cp-telechargements.component.html',
  styleUrls: ['./cp-telechargements.component.css']
})
export class CpTelechargementsComponent {
  private readonly svc = inject(ProductionService);
  private readonly stock = inject(StockService);

  readonly aujourdhui = formaterDate(new Date());
  readonly documents = DOCUMENTS;
  readonly categories: Categorie[] = ['Production', 'Équipes', 'Plans et commandes', 'Journées'];

  // ── Période ──
  presetActif = signal<'7' | '30' | '90' | 'perso'>('30');
  debut = signal(this.decalerJours(30));
  fin = signal(this.aujourdhui);
  periodeValide = computed(() => !!this.debut() && !!this.fin() && this.debut() <= this.fin() && this.fin() <= this.aujourdhui);
  messagePeriode = computed(() => {
    if (!this.debut() || !this.fin()) return 'Choisissez les deux dates.';
    if (this.debut() > this.fin()) return 'La date de début est après la date de fin.';
    if (this.fin() > this.aujourdhui) return 'La date de fin ne peut pas être dans le futur.';
    return '';
  });

  // ── Format du rapport des lots ──
  formatLots = signal<Format>('xlsx');
  readonly formatsLots: { code: Format; libelle: string }[] = [
    { code: 'xlsx', libelle: 'Excel' }, { code: 'pdf', libelle: 'PDF' }, { code: 'csv', libelle: 'CSV' }, { code: 'json', libelle: 'JSON' },
  ];

  // ── Filtre et état ──
  categorieFiltre = signal<Categorie | ''>('');
  enCours = signal<string | null>(null);
  erreur = signal('');
  notice = signal('');
  historique = signal<{ titre: string; heure: Date }[]>([]);
  documentsAffiches = computed(() => this.documents.filter(d => !this.categorieFiltre() || d.categorie === this.categorieFiltre()));


  choisirPreset(p: '7' | '30' | '90'): void {
    this.presetActif.set(p);
    this.debut.set(this.decalerJours(Number(p)));
    this.fin.set(this.aujourdhui);
  }

  majPeriode(champ: 'debut' | 'fin', valeur: string): void {
    if (!valeur) return;
    if (champ === 'debut') this.debut.set(valeur); else this.fin.set(valeur);
    this.presetActif.set('perso');
  }

  private decalerJours(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1));
    return formaterDate(d);
  }

  // ── Téléchargement ──
  telecharger(doc: DocumentDef): void {
    if (!this.periodeValide() || this.enCours()) return;
    this.enCours.set(doc.code);
    this.erreur.set('');
    this.notice.set('');

    if (doc.serveur) {
      this.svc.getRapportLots(this.debut(), this.fin(), this.formatLots()).subscribe({
        next: blob => this.terminer(doc, blob, `rapport-lots-${this.debut()}-${this.fin()}.${this.formatLots()}`),
        error: e => this.echouer(e, 'Le rapport des lots n\'a pas pu être généré.'),
      });
      return;
    }

    this.construire(doc.code).subscribe({
      next: ({ nom, lignes }) => {
        if (!lignes.length) {
          this.enCours.set(null);
          this.notice.set(`${doc.titre} : aucune donnée sur la période choisie, rien à télécharger.`);
          return;
        }
        const blob = new Blob(['﻿' + csv(lignes)], { type: 'text/csv;charset=utf-8' });
        this.terminer(doc, blob, `${nom}-${this.debut()}-${this.fin()}.csv`);
      },
      error: e => this.echouer(e, `${doc.titre} n'a pas pu être généré.`),
    });
  }

  private terminer(doc: DocumentDef, blob: Blob, nom: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.click();
    window.URL.revokeObjectURL(url);
    this.enCours.set(null);
    this.historique.update(h => [{ titre: doc.titre, heure: new Date() }, ...h].slice(0, 6));
  }

  private echouer(e: any, repli: string): void {
    this.enCours.set(null);
    this.erreur.set(e?.error?.erreur || e?.error?.message || repli);
  }

  /** Assemble les lignes d'un document à partir des données de la période. */
  private construire(code: string): Observable<{ nom: string; lignes: Ligne[] }> {
    const d = this.debut();
    const f = this.fin();
    const dans = (iso: string | null | undefined) => !!iso && iso.slice(0, 10) >= d && iso.slice(0, 10) <= f;

    switch (code) {
      case 'bilan':
        return this.svc.getRapportHebdomadaireProduction(d, f).pipe(map(r => ({ nom: 'bilan-production', lignes: this.lignesBilan(r) })));

      case 'pertes':
        return this.svc.getRapportHebdomadaireProduction(d, f).pipe(map(r => ({
          nom: 'pertes-broyage',
          lignes: Object.keys(r.quantiteBroyeeParTypePoudre ?? {}).map(t => ({
            'Type de poudre': t,
            'Broyé (kg)': r.quantiteBroyeeParTypePoudre[t] ?? 0,
            'Pertes (kg)': r.pertesParTypePoudre?.[t] ?? 0,
            '% pertes': r.pctPertesParTypePoudre?.[t] ?? 0,
          })),
        })));

      case 'of':
        return this.svc.getOFs().pipe(map(ofs => ({
          nom: 'ordres-fabrication',
          lignes: ofs.map((o: OFBE) => ({
            'N° OF': o.idOF, 'PPH': o.referencePPH, 'Code produit': o.codeProduit, 'Produit': o.designationProduit,
            'Demandé': o.qteDemandee, 'Réalisé': o.qteRealisee, 'Échéance': o.dateButoir ?? '', 'Statut': o.statut,
          })),
        })));

      case 'machinistes':
        return this.svc.getClassementMachinistes(d, f).pipe(map((c: ClassementMachinisteBE) => ({
          nom: 'performances-machinistes',
          lignes: c.classements.map(x => ({
            'Rang': x.rang, 'Machiniste': x.nomMachiniste, 'Matricule': x.machinisteMatricule,
            'Productivité (kg)': x.productiviteKg, 'Objectif (kg)': x.objectifTotalKg,
            'Taux de réalisation (%)': x.tauxRealisationMoyen, 'Efficacité (%)': x.efficacite,
            'Jours': x.nbJours, 'Opérations': x.operations.join(', '),
          })),
        })));

      case 'postes':
        return this.svc.getClassementExecuteurs(d, f).pipe(map((c: ClassementExecuteurBE[]) => ({
          nom: 'performances-postes',
          lignes: c.map(x => ({
            'Rang': x.rang, 'Employé': x.nomEmploye, 'Matricule': x.matriculeEmploye,
            'Quantité réalisée': x.quantiteTotaleRealisee, 'Unité': x.unite,
            'Taux de réalisation (%)': x.tauxRealisationMoyen, 'Jours affectés': x.nbJoursAffectes,
          })),
        })));

      case 'registres':
        return this.svc.getRegistres({ debut: d, fin: f }).pipe(map((regs: RegistreProductionBE[]) => ({
          nom: 'registre-employes',
          lignes: regs.flatMap(r => r.lignes.map(l => ({
            'Date': r.date, 'PPH': r.referencePPH, 'Matricule': l.matriculeEmploye, 'Employé': l.nomEmploye,
            'Poste': l.poste, 'Présent': l.present ? 'Oui' : 'Non', 'Arrivée': l.heureArrivee ?? '',
            'Motif d\'absence': l.motifAbsence ?? '', 'Quantité réalisée': l.qteRealisee, 'Unité': l.unite ?? '',
          }))),
        })));

      case 'affectations':
        return this.svc.getAffectations({ debut: d, fin: f }).pipe(map((affs: AffectationBE[]) => ({
          nom: 'affectations',
          lignes: affs.flatMap(a => a.lignes.map(l => ({
            'Date': a.date, 'PPH': a.referencePPH, 'Responsable': a.matriculeAgent, 'Statut': a.statut,
            'Poste': l.libellePoste, 'Effectif de référence': l.effectifReference, 'Effectif réel': l.effectifReel,
            'Objectif ajusté': l.objectifAjuste, 'Unité': l.unite, 'Employés': l.matriculesEmployes.join(', '),
          }))),
        })));

      case 'pph':
        return this.svc.getPPHs().pipe(map((pphs: PPHBE[]) => ({
          nom: 'plans-production',
          lignes: pphs
            .filter(p => p.dateFin >= d && p.dateDebut <= f)
            .flatMap(p => p.lignes.map(l => ({
              'PPH': p.referencePPH, 'BC': p.referenceBC ?? '', 'Semaine': p.semaine, 'Statut': p.statut,
              'Début': p.dateDebut, 'Fin': p.dateFin, 'Code produit': l.codeProduit, 'Produit': l.nomProduit,
              'Objectif semaine': l.objectifSemaine, 'Réalisé': l.productionRealisee,
              'Attendu (kg)': l.quantiteAttendueKg, 'Attendu (unités)': l.quantiteAttendueUnites,
            }))),
        })));

      case 'bc':
        return this.stock.getBonsCommande().pipe(map((bcs: BonCommandeBE[]) => ({
          nom: 'bons-commande',
          lignes: bcs
            .filter(b => dans(b.dateCreation))
            .flatMap(b => b.lignes.map(l => ({
              'N° BC': b.numero, 'Fournisseur': b.nomFournisseur ?? b.codeFournisseur, 'Statut BC': b.statut,
              'Date création': b.dateCreation.slice(0, 10), 'Date commande': b.dateCommande ?? '',
              'Livraison prévue': b.dateLivraisonPrevue ?? '', 'Code produit': l.codeProduit, 'Désignation': l.designation,
              'Commandé': l.quantiteCommandee, 'Produit': l.quantiteProduite ?? '', 'Unité': l.unite ?? '',
              'Taux de réalisation (%)': l.tauxRealisation ?? '',
            }))),
        })));

      case 'besoins':
        return this.svc.getBesoins().pipe(map((bs: ExpressionBesoinBE[]) => ({
          nom: 'expressions-besoin',
          lignes: bs.filter(b => dans(b.dateCreation)).map(b => ({
            'N°': b.numero, 'Date de la demande': b.dateCreation.slice(0, 10), 'Type': b.type,
            'Code produit': b.codeProduit, 'Désignation': b.designationProduit, 'Quantité': b.quantiteDemandee,
            'Unité': b.unite, 'PPH': b.referencePPH ?? '', 'Demandeur': b.matriculeDemandeur,
            'Statut': b.statut, 'Traité par': b.matriculeValidateur ?? '', 'Motif de rejet': b.motifRejet ?? '',
          })),
        })));

      case 'broyage':
        return this.svc.getSessionsBroyage({ debut: d, fin: f }).pipe(map((ss: SessionBroyageBE[]) => ({
          nom: 'sessions-broyage',
          lignes: ss.map(s => ({
            'Date': s.date, 'PPH': s.referencePPH, 'Poudre': s.typePoudreLibelle, 'Chef machiniste': s.matriculeChefMachiniste,
            'Objectif (kg)': s.objectifJournalierKg, 'Réalisé (kg)': s.totalRealiseKg, 'Net broyé (kg)': s.quantiteNetteBroyeeKg ?? '',
            'Pertes (kg)': s.pertesKg ?? '', '% pertes': s.pctPertes ?? '', 'Statut': s.statut, 'Journée validée': s.journeeValidee ? 'Oui' : 'Non',
          })),
        })));

      case 'dosage':
        return this.svc.getSessionsDosageParPeriode(d, f).pipe(map((ss: SessionDosageBE[]) => ({
          nom: 'sessions-dosage',
          lignes: ss.map(s => ({
            'Date': s.date, 'PPH': s.referencePPH, 'Agent doseur': s.matriculeAgentDoseur,
            'Fûts produits': s.nbFutsProduits, 'Fûts nets': s.nbFutsNets, 'Fûts cassés': s.nbFutsCasses,
            'Machines': s.machinesMobilisees.join(', '), 'Clôturé': s.cloturee ? 'Oui' : 'Non',
            'Validé': s.validee ? 'Oui' : 'Non', 'En pause': s.enPause ? 'Oui' : 'Non', 'Justification écart': s.justificationEcart ?? '',
          })),
        })));

      default:
        return of({ nom: code, lignes: [] });
    }
  }

  /** Bilan : une ligne par indicateur, regroupées par section. */
  private lignesBilan(r: RapportHebdomadaireProductionBE): Ligne[] {
    const l: Ligne[] = [
      { Section: 'Indicateurs', Indicateur: 'Production validée (kg)', Valeur: r.totalQuantiteLots },
      { Section: 'Indicateurs', Indicateur: 'Lots validés', Valeur: r.totalLotsValides },
      { Section: 'Indicateurs', Indicateur: 'Fûts nets', Valeur: r.totalFutsNets },
      { Section: 'Indicateurs', Indicateur: 'Fûts sortis', Valeur: r.totalFutsProduits },
      { Section: 'Indicateurs', Indicateur: 'Taux de pertes global (%)', Valeur: r.tauxPertesGlobal },
      { Section: 'Indicateurs', Indicateur: 'Sessions de broyage', Valeur: r.nbSessionsBroyage },
      { Section: 'Indicateurs', Indicateur: 'Sessions de dosage', Valeur: r.nbSessionsDosage },
      { Section: 'Indicateurs', Indicateur: 'Fiches produit', Valeur: r.nbFiches },
    ];
    for (const [ref, q] of Object.entries(r.quantitesParReference ?? {})) {
      l.push({ Section: 'Production par référence', Indicateur: ref, Valeur: q });
    }
    for (const [bc, taux] of Object.entries(r.tauxAvancementParBC ?? {})) {
      l.push({ Section: 'Avancement par BC (%)', Indicateur: bc, Valeur: taux });
    }
    for (const [t, kg] of Object.entries(r.quantiteBroyeeParTypePoudre ?? {})) {
      l.push({ Section: 'Broyage (kg)', Indicateur: t, Valeur: kg });
    }
    return l;
  }

  // ── Affichage ──
  libelleFormat(f: Format): string {
    return this.formatsLots.find(x => x.code === f)?.libelle ?? f;
  }
}
