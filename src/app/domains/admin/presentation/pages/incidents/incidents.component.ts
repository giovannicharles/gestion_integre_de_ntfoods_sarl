import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ToastService } from '../../../../../core/services/toast.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { DocumentsPanelComponent } from '../../../../../shared/documents-panel/documents-panel.component';
import { CanDirective } from '../../../../../shared/directives/can.directive';

export interface Incident {
  id: number;
  reference: string;
  type: string;
  priorite: string;
  titre: string;
  description: string;
  signaleurNom: string;
  signaleurMatricule: string;
  moduleConcerne: string;
  entityType: string | null;
  entityId: number | null;
  statut: string;
  assigneAMatricule?: string;
  assigneANom?: string;
  resolution?: string;
  resoluParMatricule?: string;
  dateCreation: string;
  dateResolution?: string;
  tempsResolutionHeures?: number;
  tags: string;
}

export interface IncidentComment {
  id: number;
  incidentId: number;
  auteurMatricule: string;
  auteurNom: string;
  contenu: string;
  estSolution: boolean | null;
  estInterne: boolean | null;
  dateCreation: string;
}

export interface EtapeHistorique {
  cle: string;
  icone: string;
  classe: string;
  titre: string;
  detail: string;
  date: string | null;
}

/**
 * Kanban Incidents (2026-09-30) — réécrit : jamais routé (aucune entrée de menu, aucune route ne pointait vers ce
 * composant) et appelait `/api/v1/incidents` (le vrai chemin est `incidents`, sans `v1`), `resoudre`/`assigner`
 * en POST (le backend exige PUT), `assigner` avec un corps vide (le backend exige `{assigneAMatricule}`) — 0 appel
 * n'aurait fonctionné.
 *
 * Gestion (ce tableau) réservée à ADMIN seul depuis le 2026-10-25 (demande explicite du porteur) — le DG ne
 * gère plus les incidents, il les signale comme tout le monde (voir `shared/signaler-incident`). Monté
 * uniquement sous `/admin/incidents` désormais.
 */
@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentsPanelComponent, CanDirective],
  templateUrl: './incidents.component.html',
  styleUrls: ['./incidents.component.css'],
})
export class IncidentsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  incidents = signal<Incident[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  actionEnCours = false;

  filtrePriorite = signal<string>('TOUS');
  afficherRejetes = signal(false);

  showCreateModal = false;
  showDetailsModal = false;
  showResolveModal = false;
  showRejectModal = false;

  selectedIncident: Incident | null = null;
  resolution = '';
  motifRejet = '';

  newIncident = {
    type: 'TECHNIQUE',
    priorite: 'MOYENNE',
    titre: '',
    description: '',
    moduleConcerne: '',
    tags: '',
  };

  types = ['TECHNIQUE', 'FONCTIONNEL', 'DONNEES', 'SECURITE', 'PERFORMANCE'];
  priorites = ['CRITIQUE', 'HAUTE', 'MOYENNE', 'BASSE'];

  private parNiveau = (statut: string) => computed(() =>
    this.incidents()
      .filter((i) => i.statut === statut)
      .filter((i) => this.filtrePriorite() === 'TOUS' || i.priorite === this.filtrePriorite())
  );

  colonneNouveau = this.parNiveau('OUVERT');
  colonneEnCours = this.parNiveau('EN_COURS');
  colonneResolu = this.parNiveau('RESOLU');
  colonneCloture = this.parNiveau('CLOTURE');
  colonneRejete = this.parNiveau('REJETE');

  ngOnInit() {
    this.chargerIncidents();
  }

  chargerIncidents() {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<Incident[]>('incidents').subscribe({
      next: (data: any) => {
        this.incidents.set(data?.donnees ?? data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractApiError(err));
        this.loading.set(false);
      },
    });
  }

  ouvrirCreation() {
    this.showCreateModal = true;
  }

  creerIncident() {
    if (!this.newIncident.titre.trim() || this.actionEnCours) return;
    this.actionEnCours = true;
    this.api.post('incidents', this.newIncident).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.showCreateModal = false;
        this.resetForm();
        this.toast.success('Incident signalé.');
        this.chargerIncidents();
      },
      error: (err) => {
        this.actionEnCours = false;
        this.toast.error(extractApiError(err), 'Signalement impossible');
      },
    });
  }

  // ── Commentaires (2026-10-25) — endpoints déjà prêts (IncidentController.java:108,117),
  // jamais appelés : ni fil de discussion, ni « mes incidents » pour le signaleur. ──
  commentaires = signal<IncidentComment[]>([]);
  chargementCommentaires = signal(false);
  nouveauCommentaire = '';
  commentaireEstSolution = false;
  envoiCommentaireEnCours = signal(false);

  ouvrirDetails(incident: Incident) {
    this.selectedIncident = incident;
    this.showDetailsModal = true;
    this.chargerCommentaires(incident.id);
  }

  chargerCommentaires(incidentId: number): void {
    this.chargementCommentaires.set(true);
    this.api.get<any>(`incidents/${incidentId}/commentaires`).subscribe({
      next: (data) => { this.commentaires.set(data?.donnees ?? data ?? []); this.chargementCommentaires.set(false); },
      error: () => this.chargementCommentaires.set(false),
    });
  }

  envoyerCommentaire(): void {
    const incident = this.selectedIncident;
    if (!incident || !this.nouveauCommentaire.trim() || this.envoiCommentaireEnCours()) return;
    this.envoiCommentaireEnCours.set(true);
    this.api.post(`incidents/${incident.id}/commentaires`, {
      contenu: this.nouveauCommentaire.trim(),
      estSolution: this.commentaireEstSolution,
      estInterne: false,
    }).subscribe({
      next: () => {
        this.envoiCommentaireEnCours.set(false);
        this.nouveauCommentaire = '';
        this.commentaireEstSolution = false;
        this.chargerCommentaires(incident.id);
      },
      error: (err) => { this.envoiCommentaireEnCours.set(false); this.toast.error(extractApiError(err), 'Envoi impossible'); },
    });
  }

  /** « Prendre en charge » — s'assigne l'incident à soi-même, aucun annuaire de techniciens n'étant exposé ici. */
  prendreEnCharge(incident: Incident) {
    if (this.actionEnCours) return;
    this.actionEnCours = true;
    const moi = this.auth.user()?.matricule;
    this.api.put(`incidents/${incident.id}/assigner`, { assigneAMatricule: moi }).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.toast.success('Incident pris en charge.');
        this.chargerIncidents();
      },
      error: (err) => {
        this.actionEnCours = false;
        this.toast.error(extractApiError(err), 'Prise en charge impossible');
      },
    });
  }

  ouvrirResolution(incident: Incident) {
    this.selectedIncident = incident;
    this.showResolveModal = true;
    this.resolution = '';
  }

  resoudreIncident() {
    if (!this.selectedIncident || !this.resolution.trim() || this.actionEnCours) return;
    this.actionEnCours = true;
    this.api.put(`incidents/${this.selectedIncident.id}/resoudre`, { resolution: this.resolution }).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.showResolveModal = false;
        this.selectedIncident = null;
        this.resolution = '';
        this.toast.success('Incident résolu.');
        this.chargerIncidents();
      },
      error: (err) => {
        this.actionEnCours = false;
        this.toast.error(extractApiError(err), 'Résolution impossible');
      },
    });
  }

  cloturerIncident(incident: Incident) {
    if (this.actionEnCours) return;
    this.actionEnCours = true;
    this.api.put(`incidents/${incident.id}/cloturer`, {}).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.toast.success('Incident clôturé.');
        this.chargerIncidents();
      },
      error: (err) => {
        this.actionEnCours = false;
        this.toast.error(extractApiError(err), 'Clôture impossible');
      },
    });
  }

  ouvrirRejet(incident: Incident) {
    this.selectedIncident = incident;
    this.showRejectModal = true;
    this.motifRejet = '';
  }

  rejeterIncident() {
    if (!this.selectedIncident || !this.motifRejet.trim() || this.actionEnCours) return;
    this.actionEnCours = true;
    this.api.put(`incidents/${this.selectedIncident.id}/rejeter`, { motif: this.motifRejet }).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.showRejectModal = false;
        this.selectedIncident = null;
        this.motifRejet = '';
        this.toast.success('Incident rejeté.');
        this.chargerIncidents();
      },
      error: (err) => {
        this.actionEnCours = false;
        this.toast.error(extractApiError(err), 'Rejet impossible');
      },
    });
  }

  resetForm() {
    this.newIncident = { type: 'TECHNIQUE', priorite: 'MOYENNE', titre: '', description: '', moduleConcerne: '', tags: '' };
  }

  fermerCreateModal() { this.showCreateModal = false; this.resetForm(); }
  fermerDetailsModal() {
    this.showDetailsModal = false;
    this.selectedIncident = null;
    this.commentaires.set([]);
    this.nouveauCommentaire = '';
    this.commentaireEstSolution = false;
  }
  fermerResolveModal() { this.showResolveModal = false; this.selectedIncident = null; this.resolution = ''; }
  fermerRejectModal() { this.showRejectModal = false; this.selectedIncident = null; this.motifRejet = ''; }

  classeGravite(priorite: string): string {
    switch (priorite) {
      case 'CRITIQUE': return 'gravite-critique';
      case 'HAUTE': return 'gravite-haute';
      case 'MOYENNE': return 'gravite-moyenne';
      case 'BASSE': return 'gravite-basse';
      default: return '';
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('fr-FR');
  }

  /**
   * Historique vertical de l'incident (2026-10-25, demande explicite du porteur : « améliore
   * l'affichage des historiques »). Construit uniquement à partir des champs réellement renvoyés
   * par IncidentResponse — pas de date de prise en charge ni de clôture côté backend aujourd'hui :
   * ces étapes s'affichent donc sans horodatage plutôt que d'en inventer un.
   */
  historique(i: Incident): EtapeHistorique[] {
    const etapes: EtapeHistorique[] = [
      {
        cle: 'signale', icone: 'fa-flag', classe: 'etape-signale',
        titre: 'Signalé', detail: `${i.signaleurNom} (${i.signaleurMatricule})`,
        date: i.dateCreation,
      },
    ];
    if (i.assigneANom) {
      etapes.push({
        cle: 'pris-en-charge', icone: 'fa-user-check', classe: 'etape-cours',
        titre: 'Pris en charge', detail: i.assigneANom, date: null,
      });
    }
    if (i.statut === 'RESOLU' || i.statut === 'CLOTURE') {
      etapes.push({
        cle: 'resolu', icone: 'fa-check', classe: 'etape-resolu',
        titre: 'Résolu', detail: i.resolution || '—',
        date: i.dateResolution ?? null,
      });
    }
    if (i.statut === 'CLOTURE') {
      etapes.push({
        cle: 'cloture', icone: 'fa-box-archive', classe: 'etape-cloture',
        titre: 'Clôturé', detail: '', date: null,
      });
    }
    if (i.statut === 'REJETE') {
      etapes.push({
        cle: 'rejete', icone: 'fa-ban', classe: 'etape-rejete',
        titre: 'Rejeté', detail: '', date: null,
      });
    }
    return etapes;
  }
}
