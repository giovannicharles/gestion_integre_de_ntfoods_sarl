import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/http/api.service';
import { extractApiError } from '../../core/http/api-error-parser';
import { ToastService } from '../../core/services/toast.service';

interface MonIncident {
  id: number;
  reference: string;
  titre: string;
  priorite: string;
  statut: string;
  resolution?: string;
  dateCreation: string;
}

/**
 * Bouton + modal « Signaler un incident », autonome et réutilisable dans n'importe quel layout.
 *
 * 2026-10-25 (demande explicite du porteur) : la gestion des incidents (prise en charge,
 * résolution, clôture) est réservée à ADMIN ; tous les autres rôles — DG compris — ne font que
 * signaler, exactement comme `POST /incidents` l'autorise déjà côté serveur (`isAuthenticated()`,
 * IncidentController.java). Avant ce composant, seul l'écran de gestion admin/DG exposait ce
 * formulaire ; aucun autre rôle n'avait d'endroit où signaler un problème.
 *
 * Complété le 2026-10-25 (audit) : `GET /incidents/mes-incidents` existait déjà côté serveur,
 * jamais appelé — un rôle qui signale un incident n'avait ensuite aucun moyen de suivre son
 * statut. Vue "Mes signalements" ajoutée, en lecture seule (le fil de discussion complet reste
 * sur l'écran de gestion ADMIN, qui a déjà la UI pour ça).
 */
@Component({
  selector: 'app-signaler-incident',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="tb-icon-btn" (click)="ouvrirMesSignalements()" title="Mes signalements">
      <i class="fa-solid fa-list-check"></i>
    </button>
    <button class="tb-icon-btn" (click)="ouvrir()" title="Signaler un incident">
      <i class="fa-solid fa-triangle-exclamation"></i>
    </button>

    @if (showModal()) {
      <div class="si-overlay" (click)="fermer()">
        <div class="si-modal" (click)="$event.stopPropagation()">
          <div class="si-header">
            <h3><i class="fa-solid fa-triangle-exclamation"></i> Signaler un incident</h3>
            <button class="si-close" (click)="fermer()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="si-body">
            <div class="si-row">
              <div class="si-field">
                <label>Type *</label>
                <select [(ngModel)]="type">
                  @for (t of types; track t) { <option [value]="t">{{ t }}</option> }
                </select>
              </div>
              <div class="si-field">
                <label>Gravité *</label>
                <select [(ngModel)]="priorite">
                  @for (p of priorites; track p) { <option [value]="p">{{ p }}</option> }
                </select>
              </div>
            </div>
            <div class="si-field">
              <label>Titre * (200 caractères max)</label>
              <input type="text" [(ngModel)]="titre" maxlength="200" placeholder="Résumé court du problème">
            </div>
            <div class="si-field">
              <label>Description</label>
              <textarea [(ngModel)]="description" rows="4" placeholder="Détails, contexte, ce qui était attendu..."></textarea>
            </div>
            <div class="si-field">
              <label>Module concerné</label>
              <input type="text" [(ngModel)]="moduleConcerne" placeholder="Ex. STOCK, PRODUCTION, COMMERCIAL">
            </div>
          </div>
          <div class="si-footer">
            <button class="btn btn-ghost" (click)="fermer()" [disabled]="envoiEnCours()">Annuler</button>
            <button class="btn btn-primary" (click)="envoyer()" [disabled]="!titre.trim() || envoiEnCours()">
              @if (envoiEnCours()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { <i class="fa-solid fa-check"></i> }
              Signaler
            </button>
          </div>
        </div>
      </div>
    }

    @if (showMesSignalements()) {
      <div class="si-overlay" (click)="fermerMesSignalements()">
        <div class="si-modal" (click)="$event.stopPropagation()">
          <div class="si-header">
            <h3><i class="fa-solid fa-list-check"></i> Mes signalements</h3>
            <button class="si-close" (click)="fermerMesSignalements()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="si-body">
            @if (chargementMesSignalements()) {
              <p class="si-empty"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</p>
            } @else {
              @for (i of mesIncidents(); track i.id) {
                <div class="si-incident-item">
                  <div class="si-incident-top">
                    <span class="si-incident-ref">{{ i.reference }}</span>
                    <span class="si-statut-badge" [class]="'si-' + i.statut.toLowerCase()">{{ statutLabel(i.statut) }}</span>
                  </div>
                  <div class="si-incident-titre">{{ i.titre }}</div>
                  @if (i.resolution) { <div class="si-incident-resolution">{{ i.resolution }}</div> }
                  <div class="si-incident-date">{{ i.dateCreation | date:'dd/MM/yyyy HH:mm' }}</div>
                </div>
              } @empty {
                <p class="si-empty">Vous n'avez signalé aucun incident.</p>
              }
            }
          </div>
          <div class="si-footer">
            <button class="btn btn-ghost" (click)="fermerMesSignalements()">Fermer</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .si-overlay { position: fixed; inset: 0; background: rgba(15,23,32,.55); display:flex; align-items:center; justify-content:center; z-index: 1000; padding: 16px; }
    .si-modal { background: var(--surface, #fff); border-radius: 14px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
    .si-header { display:flex; align-items:center; justify-content:space-between; padding: 16px 20px; border-bottom: 1px solid var(--n150, #e5e7eb); }
    .si-header h3 { margin:0; font-size: 16px; display:flex; align-items:center; gap:8px; }
    .si-close { background:none; border:none; cursor:pointer; font-size:16px; color: var(--n500, #6b7280); }
    .si-body { padding: 16px 20px; display:flex; flex-direction:column; gap:14px; }
    .si-row { display:flex; gap:12px; }
    .si-field { flex:1; display:flex; flex-direction:column; gap:6px; }
    .si-field label { font-size:12px; font-weight:600; color: var(--n600, #4b5563); }
    .si-field input, .si-field select, .si-field textarea {
      padding: 9px 12px; border: 1.5px solid var(--n200, #e5e7eb); border-radius: 8px; font-size: 13px; font-family: inherit;
    }
    .si-footer { display:flex; justify-content:flex-end; gap:10px; padding: 14px 20px; border-top: 1px solid var(--n150, #e5e7eb); }
    .si-empty { text-align:center; color: var(--n500, #6b7280); font-size: 13px; padding: 12px 0; }
    .si-incident-item { border: 1px solid var(--n150, #e5e7eb); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
    .si-incident-top { display:flex; align-items:center; justify-content:space-between; margin-bottom: 4px; }
    .si-incident-ref { font-size: 11px; font-family: monospace; color: var(--n500, #6b7280); }
    .si-incident-titre { font-weight: 600; font-size: 13px; }
    .si-incident-resolution { font-size: 12px; color: var(--n600, #4b5563); margin-top: 4px; background: var(--n50, #f9fafb); padding: 6px 8px; border-radius: 6px; }
    .si-incident-date { font-size: 11px; color: var(--n500, #6b7280); margin-top: 4px; }
    .si-statut-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; }
    .si-ouvert { background: #fef3c7; color: #92400e; }
    .si-en_cours { background: #dbeafe; color: #1e40af; }
    .si-resolu { background: #d1fae5; color: #065f46; }
    .si-cloture { background: #e5e7eb; color: #374151; }
    .si-rejete { background: #fee2e2; color: #991b1b; }
  `],
})
export class SignalerIncidentComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  showModal = signal(false);
  envoiEnCours = signal(false);

  types = ['TECHNIQUE', 'FONCTIONNEL', 'DONNEES', 'SECURITE', 'PERFORMANCE'];
  priorites = ['CRITIQUE', 'HAUTE', 'MOYENNE', 'BASSE'];

  type = 'TECHNIQUE';
  priorite = 'MOYENNE';
  titre = '';
  description = '';
  moduleConcerne = '';

  // ── Mes signalements ──────────────────────────────────────────────────────
  showMesSignalements = signal(false);
  chargementMesSignalements = signal(false);
  mesIncidents = signal<MonIncident[]>([]);

  ouvrir() { this.showModal.set(true); }
  fermer() { this.showModal.set(false); this.resetForm(); }

  envoyer() {
    if (!this.titre.trim() || this.envoiEnCours()) return;
    this.envoiEnCours.set(true);
    this.api.post('incidents', {
      type: this.type, priorite: this.priorite, titre: this.titre,
      description: this.description, moduleConcerne: this.moduleConcerne, tags: '',
    }).subscribe({
      next: () => {
        this.envoiEnCours.set(false);
        this.toast.success('Incident signalé. Il sera traité par l\'administration.');
        this.fermer();
      },
      error: (err) => {
        this.envoiEnCours.set(false);
        this.toast.error(extractApiError(err), 'Signalement impossible');
      },
    });
  }

  private resetForm() {
    this.type = 'TECHNIQUE'; this.priorite = 'MOYENNE';
    this.titre = ''; this.description = ''; this.moduleConcerne = '';
  }

  ouvrirMesSignalements(): void {
    this.showMesSignalements.set(true);
    this.chargementMesSignalements.set(true);
    this.api.get<any>('incidents/mes-incidents').subscribe({
      next: (data) => { this.mesIncidents.set(data?.donnees ?? data ?? []); this.chargementMesSignalements.set(false); },
      error: () => this.chargementMesSignalements.set(false),
    });
  }
  fermerMesSignalements(): void { this.showMesSignalements.set(false); }

  statutLabel(statut: string): string {
    const map: Record<string, string> = {
      OUVERT: 'Ouvert', EN_COURS: 'En cours', RESOLU: 'Résolu', CLOTURE: 'Clôturé', REJETE: 'Rejeté',
    };
    return map[statut] ?? statut;
  }
}
