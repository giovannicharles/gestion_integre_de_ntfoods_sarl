import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProductionService, PPHBE, AffectationBE, SessionDosageBE
} from '../../../../infrastructure/production.service';

interface LigneProdIndiv {
  matricule: string;
  nom: string;
  quantite: number | null;
}

@Component({
  selector: 'app-rs-production-individuelle',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './rs-production-individuelle.component.html',
  styleUrls: ['./rs-production-individuelle.component.css', '../_shared.css']
})
export class RsProductionIndividuelleComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading       = signal(true);
  saving        = signal(false);
  message       = signal('');
  erreur        = signal('');
  pphs          = signal<PPHBE[]>([]);
  affectation   = signal<AffectationBE | null>(null);
  sessionsDoseur = signal<SessionDosageBE[]>([]);

  referencePPH = '';
  posteChoisi  = '';
  lignes: LigneProdIndiv[] = [];

  /** Postes affectés aujourd'hui dont la saisie individuelle n'a pas encore été enregistrée */
  postesDisponibles = computed(() => {
    const a = this.affectation();
    if (!a) return [];
    const saisiesAvecIndiv = new Set(
      a.saisies
        .filter(s => s.productionsIndividuelles && s.productionsIndividuelles.length > 0)
        .map(s => s.codePoste)
    );
    return a.lignes.filter(l => !saisiesAvecIndiv.has(l.codePoste));
  });

  /** Ligne de saisie déjà existante pour le poste choisi (si re-saisie) */
  saisiePosteChoisi = computed(() =>
    this.affectation()?.saisies.find(s => s.codePoste === this.posteChoisi) ?? null
  );

  /** Limite max = quantité réalisée pour le poste (si enregistrée) sinon objectif */
  maxPoste = computed(() => {
    const s = this.saisiePosteChoisi();
    const ligne = this.affectation()?.lignes.find(l => l.codePoste === this.posteChoisi);
    if (s) return s.quantiteRealisee;
    if (ligne) return ligne.objectifAjuste;
    return 0;
  });

  /** Total des quantités saisies dans les lignes individuelles */
  totalSaisi(): number {
  return this.lignes.reduce((sum, l) => sum + (l.quantite ?? 0), 0);
}

  /** Dépassement de la limite */
  depassement(): boolean {
  const max = this.maxPoste();
  return max > 0 && this.totalSaisi() > max;
}

  unitePosteChoisi = computed(() => {
    const a = this.affectation();
    const s = this.saisiePosteChoisi();
    if (s) return s.unite;
    return a?.lignes.find(l => l.codePoste === this.posteChoisi)?.unite ?? '';
  });

  ngOnInit(): void {
    this.svc.getPPHs('EN_COURS').subscribe({
      next: p => {
        this.pphs.set(p);
        if (p.length) { this.referencePPH = p[0].referencePPH; this.charger(); }
        else this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  charger(): void {
    if (!this.referencePPH) return;
    this.loading.set(true);
    this.message.set('');
    this.erreur.set('');
    this.posteChoisi = '';
    this.lignes = [];
    this.svc.getAffectationDuJour(this.referencePPH).subscribe({
      next: a  => { this.affectation.set(a); this.loading.set(false); },
      error: () => { this.affectation.set(null); this.loading.set(false); }
    });
    this.svc.getSessionsDosageParDate(new Date().toISOString().split('T')[0]).subscribe({
      next: s  => this.sessionsDoseur.set(s),
      error: () => this.sessionsDoseur.set([])
    });
  }

  /** Quand on change de poste : auto-remplir les lignes avec les employés affectés */
  onPosteChange(codePoste: string): void {
  this.posteChoisi = codePoste;
  this.message.set('');
  this.erreur.set('');
  if (!codePoste) { this.lignes = []; return; }

  const aff = this.affectation();
  const ligne = aff?.lignes.find(l => l.codePoste === codePoste);
  if (!ligne) { this.lignes = []; return; }

  // Construit une table matricule -> nom à partir des productions déjà saisies
  const nomsConnus = new Map<string, string>();
  aff?.saisies.forEach(s =>
    s.productionsIndividuelles?.forEach(pi => {
      if (pi.matriculeEmploye && pi.nomEmploye) {
        nomsConnus.set(pi.matriculeEmploye, pi.nomEmploye);
      }
    })
  );

  const matricules = ligne.matriculesEmployes ?? [];
  if (matricules.length > 0) {
    // Une ligne par employé affecté ; nom résolu si connu, sinon vide
    this.lignes = matricules.map(mat => ({
      matricule: mat,
      nom: nomsConnus.get(mat) ?? '',   // plus jamais le matricule
      quantite: null
    }));
  } else {
    // Poste sans matricules enregistrés → 1 ligne vide
    this.lignes = [{ matricule: '', nom: '', quantite: null }];
  }
}
  ajouterLigne(): void {
    this.lignes.push({ matricule: '', nom: '', quantite: null });
  }

  retirerLigne(i: number): void {
    if (this.lignes.length > 1) this.lignes.splice(i, 1);
  }

  enregistrer(): void {
    const a = this.affectation();
    if (!a || !this.posteChoisi) { this.erreur.set('Sélectionnez un poste'); return; }

    const productions = this.lignes.filter(l => l.matricule.trim() && (l.quantite ?? 0) > 0);
    if (!productions.length) { this.erreur.set('Ajoutez au moins un employé avec une quantité'); return; }

    const total = productions.reduce((s, l) => s + (l.quantite ?? 0), 0);
    const max   = this.maxPoste();
    if (max > 0 && total > max) {
      this.erreur.set(
        `Le total individuel (${total.toFixed(1)}) dépasse la production du poste (${max.toFixed(1)} ${this.unitePosteChoisi()}).`
      );
      return;
    }

    this.saving.set(true);
    this.erreur.set('');
    this.message.set('');
    this.svc.saisirRealisationPoste({
      affectationId: a.id,
      poste: this.posteChoisi,
      quantiteRealisee: total,
      productionsIndividuelles: productions.map(l => ({
        matriculeEmploye: l.matricule.trim(),
        nomEmploye:       l.nom.trim() || l.matricule.trim(),
        poste:            this.posteChoisi,
        quantiteRealisee: l.quantite ?? 0,
      })),
    }).subscribe({
      next: updated => {
        this.affectation.set(updated);
        this.message.set('Productions individuelles enregistrées avec succès.');
        this.posteChoisi = '';
        this.lignes = [];
        this.saving.set(false);
      },
      error: err => {
        this.erreur.set(err?.error?.erreur ?? err?.error?.message ?? 'Erreur lors de l\'enregistrement.');
        this.saving.set(false);
      }
    });
  }

  aSaisiesIndividuelles(): boolean {
    return (this.affectation()?.saisies ?? []).some(s => s.productionsIndividuelles && s.productionsIndividuelles.length > 0);
  }

  lignePoste(code: string) {
    return this.affectation()?.lignes.find(l => l.codePoste === code) ?? null;
  }

  libellePoste(code: string): string {
    return this.affectation()?.lignes.find(l => l.codePoste === code)?.libellePoste ?? code;
  }
}
