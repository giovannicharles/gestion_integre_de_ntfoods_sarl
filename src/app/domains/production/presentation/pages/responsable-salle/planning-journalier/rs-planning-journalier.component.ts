import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProductionService, PPHBE, AffectationBE,
  CODES_POSTE, DUREES_AFFECTATION, CodePosteRef
} from '../../../../infrastructure/production.service';

interface LigneEdit {
  poste: string;
  libellePoste: string;
  matriculesTexte: string; // virgule-séparés
  duree: string;
}

@Component({
  selector: 'app-rs-planning-journalier',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rs-planning-journalier.component.html',
  styleUrls: ['./rs-planning-journalier.component.css', '../_shared.css']
})
export class RsPlanningJournalierComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading    = signal(true);
  actionning = signal(false);
  message    = signal('');
  erreur     = signal('');

  pphs           = signal<PPHBE[]>([]);
  referencePPH   = '';
  affectation    = signal<AffectationBE | null>(null);
  modeEdition    = signal(false);

  codesPoste: CodePosteRef[] = CODES_POSTE;
  durees = DUREES_AFFECTATION;

  /** Lignes éditables en mode édition */
  lignesEdition: LigneEdit[] = [];

  readonly today = new Date().toISOString().split('T')[0];

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
    this.erreur.set('');
    this.message.set('');
    this.modeEdition.set(false);
    this.svc.getAffectationDuJour(this.referencePPH).subscribe({
      next: a  => { this.affectation.set(a); this.loading.set(false); },
      error: () => { this.affectation.set(null); this.erreur.set('Aucune affectation pour aujourd\'hui sur ce PPH.'); this.loading.set(false); }
    });
  }

  entrerModeEdition(): void {
    const a = this.affectation();
    if (!a) return;
    this.lignesEdition = a.lignes.map(l => ({
      poste: l.codePoste,
      libellePoste: l.libellePoste,
      matriculesTexte: l.matriculesEmployes.join(', '),
      duree: l.duree,
    }));
    this.modeEdition.set(true);
    this.erreur.set('');
    this.message.set('');
  }

  annulerEdition(): void {
    this.modeEdition.set(false);
    this.lignesEdition = [];
    this.erreur.set('');
  }

  ajouterLigne(): void {
    this.lignesEdition.push({ poste: '', libellePoste: '', matriculesTexte: '', duree: 'JOURNEE_COMPLETE' });
  }

  retirerLigne(i: number): void {
    this.lignesEdition.splice(i, 1);
  }

  onPosteChange(i: number, code: string): void {
    const found = this.codesPoste.find(c => c.code === code);
    this.lignesEdition[i].libellePoste = found?.libelle ?? '';
  }

  enregistrerModification(): void {
    const a = this.affectation();
    if (!a) return;
    const lignesValides = this.lignesEdition
      .filter(l => l.poste && l.matriculesTexte.trim())
      .map(l => ({
        poste: l.poste,
        matriculesEmployes: l.matriculesTexte.split(',').map(m => m.trim().toUpperCase()).filter(Boolean),
        duree: l.duree,
      }));
    if (!lignesValides.length) {
      this.erreur.set('Ajoutez au moins un poste avec des employés.');
      return;
    }
    this.actionning.set(true);
    this.erreur.set('');
    this.svc.modifierLignesAffectation(a.id, lignesValides).subscribe({
      next: updated => {
        this.affectation.set(updated);
        this.modeEdition.set(false);
        this.lignesEdition = [];
        this.message.set('Planning mis à jour avec succès.');
        this.actionning.set(false);
      },
      error: (err) => {
        this.erreur.set(err?.error?.erreur ?? err?.error?.message ?? 'Erreur lors de la mise à jour.');
        this.actionning.set(false);
      }
    });
  }

  confirmer(): void {
    const a = this.affectation();
    if (!a) return;
    this.actionning.set(true);
    this.erreur.set('');
    this.svc.validerAffectation(a.id).subscribe({
      next: updated => {
        this.affectation.set(updated);
        this.message.set('Planning confirmé — production de la journée verrouillée.');
        this.actionning.set(false);
      },
      error: (err) => {
        this.erreur.set(err?.error?.erreur ?? err?.error?.message ?? 'Erreur lors de la confirmation.');
        this.actionning.set(false);
      }
    });
  }

  objectifIndicatif(poste: string, effectif: number, duree: string): number {
    const p = this.codesPoste.find(c => c.code === poste);
    if (!p) return 0;
    const coeff = duree === 'DEMI_JOURNEE' ? 0.5 : 1;
    return Math.round(((effectif / p.effectifReference) * p.productionJournaliere * coeff) * 10) / 10;
  }

  effectifDeSaisie(texte: string): number {
    return texte.split(',').map(m => m.trim()).filter(Boolean).length;
  }

  unitePoste(code: string): string {
    return this.codesPoste.find(c => c.code === code)?.unite ?? '';
  }
}
