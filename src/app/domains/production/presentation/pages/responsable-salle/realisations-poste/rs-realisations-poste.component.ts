import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProductionService, PPHBE, AffectationBE, CODES_POSTE, CodePosteRef
} from '../../../../infrastructure/production.service';

@Component({
  selector: 'app-rs-realisations-poste',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './rs-realisations-poste.component.html',
  styleUrls: ['./rs-realisations-poste.component.css', '../_shared.css']
})
export class RsRealisationsPosteComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading    = signal(true);
  saving     = signal(false);
  message    = signal('');
  erreur     = signal('');
  pphs       = signal<PPHBE[]>([]);
  referencePPH = '';
  affectation  = signal<AffectationBE | null>(null);

  codesPoste: CodePosteRef[] = CODES_POSTE;
  posteActif = signal<string>('CARAMEL');

  // Formulaires par famille de poste
  quantiteSimple       = 0;
  chipsEpluches        = 0;
  chipsDecoupes        = 0;
  chipsKg              = 0;
  conditionnementQuantite = 0;
  conditionnementCartons  = 0;
  etiquetageSceaux     = 0;
  datageEtiquettes     = 0;
  datageSachets        = 0;

  posteEstConditionnement = computed(() => this.posteActif().startsWith('CONDITIONNEMENT_'));

  /** Saisie déjà enregistrée pour le poste actif */
  saisieActuelle = computed(() =>
    this.affectation()?.saisies.find(s => s.codePoste === this.posteActif()) ?? null
  );

  avertissementChips = computed(() => {
    const epluches = this.epluchesDejaEnregistres() ?? this.chipsEpluches;
    return this.chipsDecoupes > epluches
      ? `Attention : ${this.chipsDecoupes} régimes découpés dépassent les ${epluches} régimes épluchés (avertissement non bloquant).`
      : null;
  });

  private epluchesDejaEnregistres(): number | null {
    const s = this.affectation()?.saisies.find(x => x.codePoste === 'CHIPS_PLANTAIN');
    return s?.details?.nbRegimesEpluches ?? null;
  }

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
    this.svc.getAffectationDuJour(this.referencePPH).subscribe({
      next: a  => { this.affectation.set(a); this.loading.set(false); },
      error: () => { this.affectation.set(null); this.loading.set(false); }
    });
  }

  selectionnerPoste(code: string): void {
    this.posteActif.set(code);
    this.message.set('');
    this.erreur.set('');
  }

  objectifDuPoste(): number {
    return this.affectation()?.lignes.find(l => l.codePoste === this.posteActif())?.objectifAjuste ?? 0;
  }

  posteEstAffecte(): boolean {
    return !!this.affectation()?.lignes.some(l => l.codePoste === this.posteActif());
  }

  posteEstAffecteCode(code: string): boolean {
    return !!this.affectation()?.lignes.some(l => l.codePoste === code);
  }

  posteDejaEnregistre(code: string): boolean {
    return !!this.affectation()?.saisies.some(s => s.codePoste === code);
  }

  soumettreSimple(): void { this.envoyer(this.quantiteSimple); }

  soumettreChips(): void {
    this.envoyer(this.chipsKg, {
      nbRegimesEpluches: this.chipsEpluches,
      nbRegimesDecoupes: this.chipsDecoupes,
      kgChipsProduits: this.chipsKg,
    });
  }

  soumettreConditionnement(): void {
    this.envoyer(this.conditionnementQuantite, { nbCartonsProduits: this.conditionnementCartons });
  }

  soumettreEtiquetage(): void {
    this.envoyer(this.etiquetageSceaux, { nbSceauxEtiquetes: this.etiquetageSceaux });
  }

  soumettreDatage(): void {
    this.envoyer(this.datageEtiquettes, {
      nbEtiquettesDatees: this.datageEtiquettes,
      nbSachetsDates: this.datageSachets,
    });
  }

  private envoyer(quantiteRealisee: number, details?: Record<string, number>): void {
    const a = this.affectation();
    if (!a) { this.erreur.set('Aucune affectation active pour aujourd\'hui'); return; }
    if (!this.posteEstAffecte()) { this.erreur.set('Ce poste n\'est pas affecté aujourd\'hui'); return; }
    this.saving.set(true);
    this.erreur.set('');
    this.message.set('');
    this.svc.saisirRealisationPoste({
      affectationId: a.id,
      poste: this.posteActif(),
      quantiteRealisee,
      details: details as any,
    }).subscribe({
      next: updated => {
        this.affectation.set(updated);
        const s = updated.saisies.find(x => x.codePoste === this.posteActif());
        const warn = s?.warnings?.length ? ` — ⚠ ${s.warnings.join(' ; ')}` : '';
        this.message.set(`Réalisation enregistrée pour ${this.libellePoste(this.posteActif())}${warn}`);
        this.saving.set(false);
      },
      error: (err) => {
        this.erreur.set(err?.error?.erreur ?? err?.error?.message ?? 'Erreur lors de l\'enregistrement.');
        this.saving.set(false);
      }
    });
  }

  libellePoste(code: string): string { return this.codesPoste.find(c => c.code === code)?.libelle ?? code; }
  uniteDuPoste(code: string): string  { return this.codesPoste.find(c => c.code === code)?.unite ?? ''; }
}
