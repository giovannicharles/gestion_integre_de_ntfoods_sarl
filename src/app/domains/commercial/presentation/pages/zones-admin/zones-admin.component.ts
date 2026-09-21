import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ZoneDeVenteService, ZoneDeVenteBE } from '../../../infrastructure/zone-vente.service';

/**
 * Administration des zones de vente.
 *
 * <p>Le serveur savait déjà créer et calibrer une zone ; aucun écran ne l'appelait.
 * La consultation des taux d'occupation existait de son côté, si bien qu'on pouvait
 * constater une zone sous-exploitée sans jamais pouvoir corriger son potentiel.</p>
 *
 * <p>Écran partagé entre la Chargée RP et le Comptable : ils administrent la même
 * donnée de référence, chacun depuis son espace.</p>
 */
@Component({
  selector: 'app-zones-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './zones-admin.component.html',
  styleUrls: ['./zones-admin.component.css'],
})
export class ZonesAdminComponent implements OnInit {
  private readonly svc = inject(ZoneDeVenteService);

  loading = signal(false);
  traitementEnCours = signal<string | null>(null);
  message = signal<{ texte: string; type: 'succes' | 'erreur' } | null>(null);

  zones = signal<ZoneDeVenteBE[]>([]);
  formulaireOuvert = signal(false);

  /** Zone en cours de recalibrage, par nom. */
  calibrage = signal<string | null>(null);
  brouillonPotentiel = signal<number | null>(null);

  readonly types = ['MARCHE', 'QUARTIER', 'AXE', 'GRANDE_SURFACE', 'HORS_ZONE'];

  nom = signal('');
  type = signal(this.types[0]);
  description = signal('');
  clientsPotentiels = signal<number | null>(null);

  zonesActives = computed(() => this.zones().filter(z => z.actif));
  potentielTotal = computed(() => this.zonesActives().reduce((s, z) => s + z.clientsPotentiels, 0));
  nonCalibrees = computed(() => this.zonesActives().filter(z => z.clientsPotentiels <= 0).length);

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    this.svc.getZones()
      .pipe(catchError(() => of([] as ZoneDeVenteBE[])))
      .subscribe({
        next: z => { this.zones.set(z); this.loading.set(false); },
        error: () => {
          this.loading.set(false);
          this.afficher("Les zones n'ont pas pu être chargées.", 'erreur');
        },
      });
  }

  formulaireValide(): boolean {
    const potentiel = this.clientsPotentiels();
    return this.nom().trim().length > 0
      && potentiel !== null && Number.isFinite(potentiel) && potentiel >= 0;
  }

  creer(): void {
    if (!this.formulaireValide()) return;

    this.traitementEnCours.set('creation');
    this.svc.creerZone({
      nom: this.nom().trim(),
      type: this.type(),
      description: this.description().trim() || undefined,
      clientsPotentiels: this.clientsPotentiels()!,
    }).subscribe({
      next: (z) => {
        this.traitementEnCours.set(null);
        this.reinitialiser();
        this.formulaireOuvert.set(false);
        this.afficher(`Zone ${z.nom} créée.`, 'succes');
        this.charger();
      },
      error: (e) => {
        this.traitementEnCours.set(null);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  ouvrirCalibrage(z: ZoneDeVenteBE): void {
    this.calibrage.set(z.nom);
    this.brouillonPotentiel.set(z.clientsPotentiels);
    this.message.set(null);
  }

  annulerCalibrage(): void {
    this.calibrage.set(null);
    this.brouillonPotentiel.set(null);
  }

  calibrageValide(z: ZoneDeVenteBE): boolean {
    const p = this.brouillonPotentiel();
    return p !== null && Number.isFinite(p) && p >= 0 && p !== z.clientsPotentiels;
  }

  calibrer(z: ZoneDeVenteBE): void {
    if (!this.calibrageValide(z)) return;

    this.traitementEnCours.set(z.nom);
    this.svc.calibrer(z.nom, this.brouillonPotentiel()!).subscribe({
      next: () => {
        this.traitementEnCours.set(null);
        this.annulerCalibrage();
        this.afficher(
          `Potentiel de ${z.nom} recalibré. Le taux d'occupation de cette zone s'en trouve modifié.`,
          'succes');
        this.charger();
      },
      error: (e) => {
        this.traitementEnCours.set(null);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  private reinitialiser(): void {
    this.nom.set('');
    this.type.set(this.types[0]);
    this.description.set('');
    this.clientsPotentiels.set(null);
  }

  private afficher(texte: string, type: 'succes' | 'erreur'): void {
    this.message.set({ texte, type });
  }

  private messageErreur(e: unknown): string {
    const err = e as { error?: { message?: string; erreur?: string } };
    return err?.error?.erreur ?? err?.error?.message ?? "L'opération n'a pas abouti.";
  }
}
