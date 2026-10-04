import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ToastService } from '../../../../../core/services/toast.service';
import { AuthService } from '../../../../../core/auth/auth.service';

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
  dateCreation: string;
  dateResolution?: string;
  tempsResolutionHeures?: number;
  tags: string;
}

/**
 * Kanban Incidents (2026-09-30) — réécrit : jamais routé (aucune entrée de menu, aucune route ne pointait vers ce
 * composant) et appelait `/api/v1/incidents` (le vrai chemin est `incidents`, sans `v1`), `resoudre`/`assigner`
 * en POST (le backend exige PUT), `assigner` avec un corps vide (le backend exige `{assigneAMatricule}`) — 0 appel
 * n'aurait fonctionné. Gestion (ce tableau) réservée admin/DG, comme la route `/admin/*` ; signaler un incident
 * reste ouvert à tout utilisateur authentifié côté backend — pas encore d'écran hors admin pour ce cas, signalé
 * dans le compte rendu plutôt que deviné.
 */
@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  ouvrirDetails(incident: Incident) {
    this.selectedIncident = incident;
    this.showDetailsModal = true;
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
  fermerDetailsModal() { this.showDetailsModal = false; this.selectedIncident = null; }
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
}
