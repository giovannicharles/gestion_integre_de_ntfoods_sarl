import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProductionService, PPHBE, AffectationBE, AgentProductionBE,
  CODES_POSTE, DUREES_AFFECTATION, CodePosteRef
} from '../../../../infrastructure/production.service';

interface LigneForm {
  poste: string;
  matriculesList: string[];
  duree: string;
}

@Component({
  selector: 'app-rs-affectation-employes',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './rs-affectation-employes.component.html',
  styleUrls: ['./rs-affectation-employes.component.css', '../_shared.css']
})
export class RsAffectationEmployesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading        = signal(true);
  loadingAgents  = signal(true);
  saving         = signal(false);
  message        = signal('');
  erreur         = signal('');
  pphs           = signal<PPHBE[]>([]);
  agents         = signal<AgentProductionBE[]>([]);
  affectationCreee = signal<AffectationBE | null>(null);

  codesPoste: CodePosteRef[] = CODES_POSTE;
  durees = DUREES_AFFECTATION;

  referencePPH = '';
  readonly date = new Date().toISOString().split('T')[0];
  lignes: LigneForm[] = [{ poste: '', matriculesList: [], duree: 'JOURNEE_COMPLETE' }];

  /** Agents actifs uniquement */
  agentsActifs = computed(() => this.agents().filter(a => a.actif));

  ngOnInit(): void {
    this.charger();
    this.chargerAgents();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs('EN_COURS').subscribe({
      next: p => { this.pphs.set(p); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  chargerAgents(): void {
    this.loadingAgents.set(true);
    this.svc.getAgentsProduction().subscribe({
      next: list => { this.agents.set(list); this.loadingAgents.set(false); },
      error: () => this.loadingAgents.set(false)
    });
  }

  ajouterLigne(): void {
    this.lignes.push({ poste: '', matriculesList: [], duree: 'JOURNEE_COMPLETE' });
  }

  retirerLigne(i: number): void {
    this.lignes.splice(i, 1);
  }

  /** Agents disponibles pour la ligne i : ceux non déjà sélectionnés dans CETTE ligne */
  disponiblesPourLigne(i: number): AgentProductionBE[] {
    const selectionnes = new Set(this.lignes[i].matriculesList);
    return this.agentsActifs().filter(a => !selectionnes.has(a.matricule));
  }

  ajouterMatricule(i: number, matricule: string): void {
    if (!matricule) return;
    if (!this.lignes[i].matriculesList.includes(matricule)) {
      this.lignes[i].matriculesList = [...this.lignes[i].matriculesList, matricule];
    }
  }

  retirerMatricule(i: number, matricule: string): void {
    this.lignes[i].matriculesList = this.lignes[i].matriculesList.filter(m => m !== matricule);
  }

  nomAgent(matricule: string): string {
    return this.agents().find(a => a.matricule === matricule)?.nomComplet ?? matricule;
  }

  objectifIndicatif(poste: string, effectif: number, duree: string): number {
    const p = this.codesPoste.find(c => c.code === poste);
    if (!p) return 0;
    const coeff = duree === 'DEMI_JOURNEE' ? 0.5 : 1;
    return Math.round(((effectif / p.effectifReference) * p.productionJournaliere * coeff) * 10) / 10;
  }

  creerAffectation(): void {
    if (!this.referencePPH) { this.erreur.set('Sélectionnez un PPH en cours'); return; }
    const lignes = this.lignes
      .filter(l => l.poste && l.matriculesList.length)
      .map(l => ({ poste: l.poste, matriculesEmployes: l.matriculesList, duree: l.duree }));
    if (!lignes.length) { this.erreur.set('Ajoutez au moins un poste avec ses employés'); return; }
    this.saving.set(true);
    this.erreur.set('');
    this.message.set('');
    this.svc.creerAffectation({ referencePPH: this.referencePPH, date: this.date, lignes }).subscribe({
      next: a => {
        this.affectationCreee.set(a);
        this.message.set('Affectation créée — objectifs recalculés automatiquement par le serveur.');
        this.saving.set(false);
      },
      error: () => {
        this.erreur.set('Erreur lors de la création de l\'affectation');
        this.saving.set(false);
      }
    });
  }

  libellePoste(code: string): string {
    return this.codesPoste.find(c => c.code === code)?.libelle ?? code;
  }

  unitePoste(code: string): string {
    return this.codesPoste.find(c => c.code === code)?.unite ?? '';
  }
}
