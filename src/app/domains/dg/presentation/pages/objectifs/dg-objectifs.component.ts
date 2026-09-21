import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ComptableService, ObjectifCommercialBE, PrimeSemaineBE,
} from '../../../../comptable/infrastructure/comptable.service';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

/**
 * Définition et révision des objectifs hebdomadaires.
 *
 * <p>L'écran précédent était en trompe-l'œil : « Enregistrer » se contentait de
 * basculer un drapeau local et d'afficher un bandeau de succès, sans jamais
 * appeler le serveur. Les colonnes « CA réalisé » et « Écart » lisaient par
 * ailleurs un champ d'objectif inexistant dans la réponse.</p>
 *
 * <p>Réviser un objectif déjà fixé prend effet immédiatement sur la prime de la
 * semaine : le motif est donc exigé, et la valeur remplacée reste consultable.</p>
 */
@Component({
  selector: 'app-dg-objectifs',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './dg-objectifs.component.html',
  styleUrls: ['./dg-objectifs.component.css'],
})
export class DgObjectifsComponent implements OnInit {
  private readonly cptSvc = inject(ComptableService);

  today = new Date();
  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;
  Math = Math;

  objectifs = signal<ObjectifCommercialBE[]>([]);
  private realisations = signal<Map<string, number>>(new Map());

  semaineDebut = signal(this.lundiCourant());
  loading = signal(false);
  message = signal<{ texte: string; type: 'succes' | 'erreur' } | null>(null);

  /** Constat en cours d'édition, par identifiant d'objectif. */
  edition = signal<number | null>(null);
  brouillonMontant = signal<number | null>(null);
  brouillonMotif = signal('');
  enregistrement = signal<number | null>(null);

  /** Journal déplié, par identifiant d'objectif. */
  journalOuvert = signal<number | null>(null);

  totalObjectif = computed(() => this.objectifs().reduce((s, o) => s + o.objectifGlobalFCFA, 0));
  totalCA = computed(() => Array.from(this.realisations().values()).reduce((s, v) => s + v, 0));
  nbRevises = computed(() => this.objectifs().filter(o => o.revise).length);
  nbAtteints = computed(() =>
    this.objectifs().filter(o =>
      o.objectifGlobalFCFA > 0 && this.realiseDe(o.matriculeCommercial) >= o.objectifGlobalFCFA
    ).length
  );

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    forkJoin({
      objectifs: this.cptSvc.getObjectifsParSemaine(this.semaineDebut())
        .pipe(catchError(() => of([] as ObjectifCommercialBE[]))),
      primes: this.cptSvc.getPrimesParSemaine(this.semaineDebut())
        .pipe(catchError(() => of([] as PrimeSemaineBE[]))),
    }).subscribe({
      next: ({ objectifs, primes }) => {
        this.objectifs.set(objectifs);
        this.realisations.set(new Map(primes.map(p => [p.matriculeCommercial, p.totalVentesGlobalFCFA])));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.afficher("Les objectifs n'ont pas pu être chargés.", 'erreur');
      },
    });
  }

  changerSemaine(valeur: string): void {
    if (!valeur) return;
    this.semaineDebut.set(valeur);
    this.annulerEdition();
    this.charger();
  }

  realiseDe(matricule: string): number {
    return this.realisations().get(matricule) ?? 0;
  }

  ecartDe(o: ObjectifCommercialBE): number {
    return this.realiseDe(o.matriculeCommercial) - o.objectifGlobalFCFA;
  }

  cappedTaux(ca: number, obj: number): number {
    return Math.min(tauxAtteinte(ca, obj), 100);
  }

  gammesDe(o: ObjectifCommercialBE): string {
    const gammes = Object.keys(o.objectifsParGammeFCFA ?? {});
    return gammes.length ? gammes.join(', ') : '—';
  }

  // ── Révision ──────────────────────────────────────────────────────────────

  ouvrirEdition(o: ObjectifCommercialBE): void {
    this.edition.set(o.id);
    this.brouillonMontant.set(o.objectifGlobalFCFA);
    this.brouillonMotif.set('');
    this.message.set(null);
  }

  annulerEdition(): void {
    this.edition.set(null);
    this.brouillonMontant.set(null);
    this.brouillonMotif.set('');
  }

  basculerJournal(id: number): void {
    this.journalOuvert.set(this.journalOuvert() === id ? null : id);
  }

  /** Une révision sans motif ne serait pas opposable : le serveur la refuserait. */
  revisionValide(o: ObjectifCommercialBE): boolean {
    const montant = this.brouillonMontant();
    if (montant === null || !Number.isFinite(montant) || montant <= 0) return false;
    if (montant === o.objectifGlobalFCFA) return false;
    return this.brouillonMotif().trim().length > 0;
  }

  enregistrer(o: ObjectifCommercialBE): void {
    if (!this.revisionValide(o)) return;

    this.enregistrement.set(o.id);
    this.cptSvc.definirObjectif({
      matriculeCommercial: o.matriculeCommercial,
      semaineDebut: o.semaineDebut,
      semaineFin: o.semaineFin,
      objectifGlobalFCFA: this.brouillonMontant()!,
      // Les objectifs par gamme sont repris tels quels : cette révision ne porte
      // que sur la cible globale, et écraser les gammes par un objet vide les
      // supprimerait silencieusement.
      objectifsParGammeFCFA: o.objectifsParGammeFCFA ?? {},
      motif: this.brouillonMotif().trim(),
    }).subscribe({
      next: () => {
        this.enregistrement.set(null);
        this.annulerEdition();
        this.afficher(`Objectif de ${o.matriculeCommercial} révisé. La valeur précédente est conservée au journal.`, 'succes');
        this.charger();
      },
      error: (e) => {
        this.enregistrement.set(null);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  private lundiCourant(): string {
    const today = new Date();
    const lundi = new Date(today);
    // getDay() vaut 0 le dimanche : sans correction, on remonterait au lundi suivant.
    const decalage = (today.getDay() + 6) % 7;
    lundi.setDate(today.getDate() - decalage);
    return `${lundi.getFullYear()}-${String(lundi.getMonth() + 1).padStart(2, '0')}-${String(lundi.getDate()).padStart(2, '0')}`;
  }

  private afficher(texte: string, type: 'succes' | 'erreur'): void {
    this.message.set({ texte, type });
  }

  private messageErreur(e: unknown): string {
    const err = e as { error?: { message?: string; erreur?: string } };
    return err?.error?.erreur ?? err?.error?.message ?? "La révision n'a pas abouti.";
  }
}
