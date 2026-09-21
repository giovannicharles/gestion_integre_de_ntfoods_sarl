import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ProductionService, PPHBE, LotBE, ExpressionBesoinBE } from '../../../../infrastructure/production.service';

interface EvenementUI {
  type: 'PPH' | 'Lot' | 'Besoin';
  libelle: string;
  auteur: string;
  date: string;
  detail: string;
}

/**
 * HISTORIQUE ET AUDIT — Chef de Production
 *
 * ⚠️ Il n'existe pas de journal d'audit générique côté backend (pas de table
 * "old value / new value" par action). Cette vue reconstitue une timeline
 * d'activité à partir des seuls horodatages et auteurs déjà stockés sur les
 * entités (PPH, Lot, Expression de besoin) — c'est un historique de résultats,
 * pas un audit trail complet des modifications intermédiaires.
 */
@Component({
  selector: 'app-cp-historique',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './cp-historique.component.html',
  styleUrls: ['./cp-historique.component.css', '../_shared.css']
})
export class CpHistoriqueComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  pphs = signal<PPHBE[]>([]);
  lots = signal<LotBE[]>([]);
  besoins = signal<ExpressionBesoinBE[]>([]);
  filtreType = signal('');

  evenements = computed<EvenementUI[]>(() => {
    const liste: EvenementUI[] = [];
    for (const p of this.pphs()) {
      liste.push({ type: 'PPH', libelle: `PPH ${p.referencePPH} créé`, auteur: p.matriculeChefProduction, date: p.dateDebut, detail: `Statut : ${p.statut}` });
      if (p.dateSoumission) liste.push({ type: 'PPH', libelle: `PPH ${p.referencePPH} soumis`, auteur: p.matriculeChefProduction, date: p.dateSoumission, detail: `Semaine ${p.semaine}` });
    }
    for (const l of this.lots()) {
      liste.push({ type: 'Lot', libelle: `Lot ${l.numeroLot} déclaré`, auteur: l.matriculeChefProduction, date: l.dateProduction, detail: `${l.quantiteKg} kg — ${l.codeProduit}` });
      if (l.matriculeGestionnaireValidation) liste.push({ type: 'Lot', libelle: `Lot ${l.numeroLot} — décision stock`, auteur: l.matriculeGestionnaireValidation, date: l.dateProduction, detail: l.statut === 'REJETE' ? `Rejeté : ${l.motifRejet}` : 'Validé' });
    }
    for (const b of this.besoins()) {
      liste.push({ type: 'Besoin', libelle: `Besoin ${b.numero} signalé`, auteur: b.matriculeDemandeur, date: b.dateCreation, detail: `${b.designationProduit} — ${b.quantiteDemandee} ${b.unite}` });
      if (b.matriculeValidateur) liste.push({ type: 'Besoin', libelle: `Besoin ${b.numero} — décision`, auteur: b.matriculeValidateur, date: b.dateModification, detail: b.statut === 'REJETE' ? `Rejeté : ${b.motifRejet}` : 'Validé' });
    }
    return liste.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  });

  evenementsFiltres = computed(() => {
    const f = this.filtreType();
    return f ? this.evenements().filter(e => e.type === f) : this.evenements();
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs().subscribe({ next: p => this.pphs.set(p) });
    this.svc.getLots().subscribe({ next: l => this.lots.set(l) });
    this.svc.getBesoins().subscribe({ next: b => { this.besoins.set(b); this.loading.set(false); } });
  }
}
