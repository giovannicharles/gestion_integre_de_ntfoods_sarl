import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductionService, LigneRegistreBE, PPHBE, AgentProductionBE, AffectationBE, CODES_POSTE, CodePosteRef } from '../../../infrastructure/production.service';

interface AgentAvecPoste {
  matricule: string;
  nomComplet: string;
  poste: string;
  libellePoste: string;
}

@Component({
  selector: 'app-production-employes',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule],
  templateUrl: './production-employes.component.html',
  styleUrls: ['./production-employes.component.css']
})
export class ProductionEmployesComponent implements OnInit {
  today = new Date();

  private readonly svc = inject(ProductionService);

  employes = signal<LigneRegistreBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  agents = signal<AgentProductionBE[]>([]);
  affectationJour = signal<AffectationBE | null>(null);
  loadingAgents = signal(false);
  showEnregistrerRegistre = signal(false);
  message = signal('');
  codesPoste = signal<CodePosteRef[]>(CODES_POSTE);

  referencePPH = '';
  readonly dateRegistre = new Date().toISOString().split('T')[0];
  lignesRegistre: { matriculeEmploye: string; nomEmploye: string; poste: string; present: boolean; motifAbsence: string; heureArrivee: string; qteRealisee: number; unite: string }[] = [];

  // Consultation d'un registre précis (PPH + date)
  rechercheDate = new Date().toISOString().split('T')[0];
  registreConsulte = signal<{ nbPresents: number; nbAbsents: number; lignes: LigneRegistreBE[] } | null>(null);

  agentsDuJour = computed(() => {
    const aff = this.affectationJour();
    const agents = this.agents();
    if (!aff) {
      return agents.filter(a => a.actif).map(a => ({
        matricule: a.matricule,
        nomComplet: a.nomComplet,
        poste: '',
        libellePoste: '—'
      }));
    }
    const result: AgentAvecPoste[] = [];
    for (const ligne of aff.lignes) {
      for (const mat of ligne.matriculesEmployes) {
        const agent = agents.find(a => a.matricule === mat);
        if (agent) {
          result.push({
            matricule: agent.matricule,
            nomComplet: agent.nomComplet,
            poste: ligne.codePoste,
            libellePoste: ligne.libellePoste
          });
        }
      }
    }
    return result;
  });

  nbPresents = computed(() =>
    this.employes().filter(e => e.present).length
  );

  nbAbsents = computed(() =>
    this.employes().filter(e => !e.present).length
  );

  tauxPresence = computed(() => {
    const total = this.employes().length;
    if (total === 0) return 0;
    return Math.round((this.nbPresents() / total) * 100);
  });

  postesDistincts = computed(() => {
    const postes = new Set(this.employes().map(e => e.poste));
    return postes.size;
  });

  presentsSeul = computed(() =>
    this.employes().filter(e => e.present)
  );

  ngOnInit(): void {
    this.svc.getPostesProduction().subscribe({
      next: p => this.codesPoste.set(p.length > 0 ? p : CODES_POSTE),
      error: () => this.codesPoste.set(CODES_POSTE),
    });
    this.svc.getRegistres().subscribe({
      next: (registres) => {
        if (registres.length > 0) {
          const latest = registres[0];
          this.employes.set(latest.lignes);
        }
      },
      error: () => {},
    });
    this.svc.getPPHs().subscribe({
      next: p => this.pphs.set(p)
    });
    this.chargerAgents();
  }

  chargerAgents(): void {
    this.loadingAgents.set(true);
    this.svc.getAgentsProduction().subscribe({
      next: list => { this.agents.set(list); this.loadingAgents.set(false); },
      error: () => this.loadingAgents.set(false)
    });
  }

  onPphChange(): void {
    this.affectationJour.set(null);
    if (!this.referencePPH) return;
    this.svc.getAffectationDuJour(this.referencePPH).subscribe({
      next: a => this.affectationJour.set(a),
      error: () => this.affectationJour.set(null)
    });
  }

  ouvrirEnregistrerRegistre(): void {
    this.lignesRegistre = [this.nouvelleLigneVide()];
    this.showEnregistrerRegistre.set(true);
    if (this.referencePPH) this.onPphChange();
  }

  ajouterLigne(): void {
    this.lignesRegistre = [...this.lignesRegistre, this.nouvelleLigneVide()];
  }

  retirerLigne(index: number): void {
    this.lignesRegistre = this.lignesRegistre.filter((_, i) => i !== index);
  }

  selectionnerAgent(index: number, matricule: string): void {
    const agent = this.agentsDuJour().find(a => a.matricule === matricule);
    if (!agent) return;
    const lignes = [...this.lignesRegistre];
    lignes[index] = {
      ...lignes[index],
      matriculeEmploye: agent.matricule,
      nomEmploye: agent.nomComplet,
      poste: agent.poste
    };
    this.lignesRegistre = lignes;
  }

  private nouvelleLigneVide() {
    return { matriculeEmploye: '', nomEmploye: '', poste: '', present: true, motifAbsence: '', heureArrivee: '', qteRealisee: 0, unite: 'kg' };
  }

  enregistrerRegistre(): void {
    const lignes = this.lignesRegistre.filter(l => l.matriculeEmploye.trim() && l.nomEmploye.trim());
    if (!this.referencePPH || lignes.length === 0) {
      this.message.set('Veuillez renseigner le PPH et au moins une ligne');
      return;
    }
    this.svc.enregistrerRegistre({
      referencePPH: this.referencePPH,
      date: this.dateRegistre,
      lignes
    }).subscribe({
      next: r => {
        this.employes.set(r.lignes);
        this.showEnregistrerRegistre.set(false);
        this.message.set('Registre enregistré');
      },
      error: () => this.message.set('Erreur lors de l\'enregistrement du registre')
    });
  }

  rechercherRegistre(): void {
    if (!this.referencePPH || !this.rechercheDate) {
      this.message.set('Veuillez sélectionner un PPH et une date');
      return;
    }
    this.svc.getRegistre(this.referencePPH, this.rechercheDate).subscribe({
      next: r => this.registreConsulte.set(r),
      error: () => { this.registreConsulte.set(null); this.message.set('Aucun registre trouvé pour ce PPH et cette date'); }
    });
  }

  libellePoste(code: string): string {
    return this.codesPoste().find((c: CodePosteRef) => c.code === code)?.libelle ?? code;
  }
}
