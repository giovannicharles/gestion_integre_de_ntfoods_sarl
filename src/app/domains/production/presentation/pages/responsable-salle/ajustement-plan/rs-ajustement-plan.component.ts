import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE } from '../../../../infrastructure/production.service';
import { libelleEmballage, nomsMatieres, qteEmballage, qteMatiere, typesEmballage } from '../../../../infrastructure/production-besoins.util';

/** Ligne éditable d'objectif de production par produit */
interface LigneEdition {
  codeProduit: string;
  nomProduit: string;
  objectifSemaine: number;
  productionRealisee: number;
}

/** Ligne éditable de répartition journalière : une quantité par matière première et par composant d'emballage du plan. */
interface RepartitionEdition {
  dateJour: string;
  futsPrevus: number;
  matieres: Record<string, number>;
  emballages: Record<string, number>;
}

@Component({
  selector: 'app-rs-ajustement-plan',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './rs-ajustement-plan.component.html',
  styleUrls: ['./rs-ajustement-plan.component.css']
})
export class RsAjustementPlanComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading      = signal(true);
  saving       = signal(false);
  savingLignes = signal(false);
  actionning   = signal(false);
  message      = signal('');
  erreur       = signal('');

  pphs           = signal<PPHBE[]>([]);
  pphSelectionne = signal<PPHBE | null>(null);
  enPause        = signal(false);

  /** Copie éditable des objectifs de production par produit (issus du BC, mais ajustables) */
  lignesEdition = signal<LigneEdition[]>([]);

  /** Copie éditable de la répartition journalière */
  repartitionEdition = signal<RepartitionEdition[]>([]);

  pphsActifs = computed(() =>
    this.pphs().filter(p => p.statut !== 'CLOTURE')
  );

  /** Matières premières et composants d'emballage réellement présents dans le plan (issus des formules et compositions). */
  colonnesMatieres  = computed(() => nomsMatieres((this.pphSelectionne()?.repartitionJours ?? []).map(j => j.besoinsMatieresPremiere)));
  colonnesEmballage = computed(() => typesEmballage((this.pphSelectionne()?.repartitionJours ?? []).map(j => j.besoinsEmballage)));
  readonly libelleEmballage = libelleEmballage;

  /** Totaux par matière première calculés depuis les lignes éditées */
  totauxMP = computed(() => {
    const parMatiere = this.colonnesMatieres().map(nom => ({
      nom, total: this.repartitionEdition().reduce((s, j) => s + (j.matieres[nom] ?? 0), 0)
    }));
    return { parMatiere, total: parMatiere.reduce((s, m) => s + m.total, 0) };
  });

  /** Dernière répartition enregistrée (ou chargée), pour savoir si la saisie contient des modifications non enregistrées. */
  private enregistree = signal('');

  readonly modifie = computed(() => JSON.stringify(this.repartitionEdition()) !== this.enregistree());

  /** Vrai si toutes les quantités saisies sont des nombres positifs ou nuls. */
  readonly valeursValides = computed(() => this.repartitionEdition().every(j =>
    Object.values(j.matieres).every(v => Number.isFinite(v) && v >= 0)
    && Object.values(j.emballages).every(v => Number.isFinite(v) && v >= 0)));

  /**
   * Prévisionnel système par jour et par matière : somme des besoins des produits du jour (détail produit/jour).
   * Sert de repère à l'ajustement manuel ; un écart n'est pas une erreur, il doit être voulu.
   */
  readonly systemeParJour = computed<Map<string, Map<string, number>>>(() => {
    const resultat = new Map<string, Map<string, number>>();
    for (const l of this.pphSelectionne()?.lignesDetaillees ?? []) {
      const jour = resultat.get(l.dateJour) ?? new Map<string, number>();
      for (const b of l.besoinsMatieresPremiere ?? []) {
        jour.set(b.matierePremiere, (jour.get(b.matierePremiere) ?? 0) + b.quantiteKg);
      }
      resultat.set(l.dateJour, jour);
    }
    return resultat;
  });

  /** Quantité prévue par le système pour une matière un jour donné (0 si aucune). */
  systemeDe(dateJour: string, matiere: string): number {
    return this.systemeParJour().get(dateJour)?.get(matiere) ?? 0;
  }

  /** Écart entre la saisie et le prévisionnel système (positif = plus que prévu). */
  ecart(dateJour: string, matiere: string, saisie: number): number {
    return Math.round(((saisie ?? 0) - this.systemeDe(dateJour, matiere)) * 100) / 100;
  }

  /** Total prévu par le système pour une matière sur toute la période. */
  systemeTotal(matiere: string): number {
    return this.repartitionEdition().reduce((s, j) => s + this.systemeDe(j.dateJour, matiere), 0);
  }

  /** Annule les modifications non enregistrées et revient à la répartition du plan. */
  annulerModifications(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.repartitionEdition.set(this.versEdition(p));
    this.enregistree.set(JSON.stringify(this.repartitionEdition()));
    this.message.set('Modifications annulées.');
    this.erreur.set('');
  }

  private versEdition(p: PPHBE): RepartitionEdition[] {
    const noms = nomsMatieres((p.repartitionJours ?? []).map(j => j.besoinsMatieresPremiere));
    const types = typesEmballage((p.repartitionJours ?? []).map(j => j.besoinsEmballage));
    return (p.repartitionJours ?? []).map(j => {
      const matieres: Record<string, number> = {};
      noms.forEach(n => matieres[n] = qteMatiere(j.besoinsMatieresPremiere, n));
      const emballages: Record<string, number> = {};
      types.forEach(t => emballages[t] = qteEmballage(j.besoinsEmballage, t));
      return { dateJour: j.dateJour, futsPrevus: this.calculerFuts(matieres), matieres, emballages };
    });
  }

  /** Fûts = poudre totale du jour / 50 kg (capacité physique d'un fût). */
  private calculerFuts(matieres: Record<string, number>): number {
    const total = Object.values(matieres).reduce((s, v) => s + (v || 0), 0);
    return total <= 0 ? 0 : total / 50;
  }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs().subscribe({
      next: list => {
        const actifs = list.filter(p => p.statut !== 'CLOTURE');
        this.pphs.set(actifs);
        const brouillons = actifs.filter(p => p.statut === 'BROUILLON');
        if (brouillons.length) this.selectionner(brouillons[0]);
        else if (actifs.length) this.selectionner(actifs[0]);
        this.loading.set(false);
      },
      error: () => { this.erreur.set('Impossible de charger les plans.'); this.loading.set(false); }
    });
  }

  selectionner(p: PPHBE): void {
    this.pphSelectionne.set(p);
    this.lignesEdition.set((p.lignes ?? []).map(l => ({
      codeProduit: l.codeProduit,
      nomProduit: l.nomProduit,
      objectifSemaine: l.objectifSemaine,
      productionRealisee: l.productionRealisee
    })));
    const edition = this.versEdition(p);
    this.repartitionEdition.set(edition);
    this.enregistree.set(JSON.stringify(edition));
    this.message.set('');
    this.erreur.set('');
    this.enPause.set(false);
  }

  mettreAJourObjectif(index: number, valeur: number): void {
    this.lignesEdition.update(arr => {
      const nouvelle = [...arr];
      const l = nouvelle[index];
      if (l) nouvelle[index] = { ...l, objectifSemaine: valeur };
      return nouvelle;
    });
  }

  enregistrerLignes(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.savingLignes.set(true);
    this.erreur.set('');
    const lignes = this.lignesEdition().map(l => ({ codeProduit: l.codeProduit, objectifSemaine: l.objectifSemaine }));
    this.svc.modifierLignesPPH(p.referencePPH, lignes).subscribe({
      next: updated => {
        this.pphs.update(list => list.map(x => x.referencePPH === updated.referencePPH ? updated : x));
        this.pphSelectionne.set(updated);
        this.lignesEdition.set((updated.lignes ?? []).map(l => ({
          codeProduit: l.codeProduit, nomProduit: l.nomProduit,
          objectifSemaine: l.objectifSemaine, productionRealisee: l.productionRealisee
        })));
        this.message.set('Objectifs de production enregistrés.');
        this.savingLignes.set(false);
      },
      error: () => { this.erreur.set('Erreur lors de l\'enregistrement des objectifs.'); this.savingLignes.set(false); }
    });
  }

  recalculerFuts(index: number): void {
    this.repartitionEdition.update(arr => {
      const nouvelle = [...arr];
      const j = nouvelle[index];
      if (j) nouvelle[index] = { ...j, futsPrevus: this.calculerFuts(j.matieres) };
      return nouvelle;
    });
  }

  mettreAJourMatiere(index: number, matiere: string, valeur: number): void {
    this.repartitionEdition.update(arr => {
      const nouvelle = [...arr];
      const j = nouvelle[index];
      if (j) nouvelle[index] = { ...j, matieres: { ...j.matieres, [matiere]: valeur } };
      return nouvelle;
    });
    this.recalculerFuts(index);
  }

  mettreAJourEmballage(index: number, type: string, valeur: number): void {
    this.repartitionEdition.update(arr => {
      const nouvelle = [...arr];
      const j = nouvelle[index];
      if (j) nouvelle[index] = { ...j, emballages: { ...j.emballages, [type]: valeur } };
      return nouvelle;
    });
  }

  /**
   * Recalcule le plan depuis le BC et le catalogue actuels (formules, compositions d'emballage, période).
   * Remplace toute répartition ajustée ici ; impossible une fois le plan démarré.
   */
  recalculer(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    if (!confirm('Recalculer ce plan depuis le bon de commande et le catalogue actuels ? Vos ajustements manuels seront remplacés.')) return;
    this.actionning.set(true);
    this.erreur.set('');
    this.svc.recalculerPPH(p.referencePPH).subscribe({
      next: r => {
        this.pphs.update(list => list.map(x => x.referencePPH === r.pph.referencePPH ? r.pph : x));
        this.selectionner(r.pph);
        this.message.set(r.ajustementsManuelsEcrases
          ? 'Plan recalculé — vos ajustements manuels précédents ont été remplacés, à refaire si besoin.'
          : 'Plan recalculé.');
        this.actionning.set(false);
      },
      error: err => {
        this.erreur.set(err?.error?.message ?? 'Recalcul impossible (plan démarré ou clôturé, ou BC introuvable).');
        this.actionning.set(false);
      }
    });
  }

  enregistrer(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    if (!this.valeursValides()) {
      this.erreur.set('Les quantités ne peuvent pas être négatives.');
      return;
    }
    this.saving.set(true);
    this.erreur.set('');
    const payload = this.repartitionEdition().map(j => ({
      dateJour: j.dateJour,
      futsPrevus: j.futsPrevus,
      besoinsMatieresPremiere: Object.entries(j.matieres).map(([matierePremiere, quantiteKg]) => ({ matierePremiere, quantiteKg: quantiteKg || 0 })),
      besoinsEmballage: Object.entries(j.emballages).map(([type, quantite]) => ({ type, quantite: Math.round(quantite || 0) })),
    }));
    this.svc.ajusterRepartitionPPH(p.referencePPH, payload).subscribe({
      next: updated => {
        this.pphs.update(list => list.map(x => x.referencePPH === updated.referencePPH ? updated : x));
        this.pphSelectionne.set(updated);
        const edition = this.versEdition(updated);
        this.repartitionEdition.set(edition);
        this.enregistree.set(JSON.stringify(edition));
        this.message.set('Ajustements enregistrés avec succès.');
        this.saving.set(false);
      },
      error: () => { this.erreur.set('Erreur lors de l\'enregistrement.'); this.saving.set(false); }
    });
  }

  demarrer(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.actionning.set(true);
    this.erreur.set('');
    this.svc.demarrerPPH(p.referencePPH).subscribe({
      next: updated => {
        this.pphs.update(list => list.map(x => x.referencePPH === updated.referencePPH ? updated : x));
        this.pphSelectionne.set(updated);
        this.message.set('Production démarrée — PPH EN COURS.');
        this.actionning.set(false);
        this.enPause.set(false);
      },
      error: (err) => {
        this.erreur.set(err?.error?.message ?? 'Le PPH doit être validé par le Chef de Production avant d\'être démarré.');
        this.actionning.set(false);
      }
    });
  }

  togglePause(): void {
    this.enPause.update(v => !v);
    this.message.set(this.enPause() ? 'Production mise en pause.' : 'Production reprise.');
  }

  cloturer(): void {
    const p = this.pphSelectionne();
    if (!p) return;
    this.actionning.set(true);
    this.erreur.set('');
    this.svc.cloturerPPH(p.referencePPH).subscribe({
      next: updated => {
        this.pphs.update(list => list.filter(x => x.referencePPH !== updated.referencePPH));
        this.pphSelectionne.set(null);
        this.repartitionEdition.set([]);
        this.message.set(`PPH ${updated.referencePPH} clôturé avec succès.`);
        this.actionning.set(false);
        const suivant = this.pphsActifs()[0];
        if (suivant) this.selectionner(suivant);
      },
      error: () => { this.erreur.set('Erreur lors de la clôture.'); this.actionning.set(false); }
    });
  }

  statutClass(s: string): string {
    if (s === 'EN_COURS') return 'badge bg-orange';
    if (s === 'VALIDE')   return 'badge bg-neutral';
    return 'badge bg-neutral';
  }

  statutLibelle(s: string): string {
    return ({ BROUILLON: 'Brouillon', VALIDE: 'Validé', EN_COURS: 'En cours', CLOTURE: 'Clôturé' } as Record<string, string>)[s] ?? s;
  }

  totalObjectif(): number {
    return this.lignesEdition().reduce((t, l) => t + (l.objectifSemaine || 0), 0);
  }

  totalRealise(): number {
    return this.lignesEdition().reduce((t, l) => t + (l.productionRealisee || 0), 0);
  }

  totalFuts(): number {
    return this.repartitionEdition().reduce((t, j) => t + (j.futsPrevus || 0), 0);
  }

  progression(realise: number, prevu: number): number {
    if (!prevu) return 0;
    return Math.min(Math.round((realise / prevu) * 100), 100);
  }
}
