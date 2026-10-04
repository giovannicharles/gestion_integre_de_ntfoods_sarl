import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';

export interface Marque {
  id: number;
  code: string;
  nom: string;
  description: string;
  logoUrl: string;
  actif: boolean;
}

export interface Gamme {
  id: number;
  code: string;
  nom: string;
  description: string;
  actif: boolean;
}

export interface Variete {
  id: number;
  gammeId: number;
  gammeNom: string;
  marqueId: number;
  marqueNom: string;
  code: string;
  nom: string;
  description: string;
  poidsUnitaireG: number;
  unitePoids: string;
  actif: boolean;
}

export interface TypeEmballage {
  id: number;
  code: string;
  nom: string;
  description: string;
  niveauHierarchie: number;
  poidsVideG: number;
  materiau: string;
  actif: boolean;
}

export interface ConfigurationConditionnement {
  id: number;
  varieteId: number;
  varieteNom: string;
  typeEmballageId: number;
  typeEmballageNom: string;
  codeConfiguration: string;
  niveau: number;
  quantiteUnites: number;
  poidsNetG: number;
  poidsBrutG: number;
  poidsTotalKg: number;
  referenceProduit: string;
  codeBarres: string;
  estDefault: boolean;
  actif: boolean;
}

@Component({
  selector: 'app-conditionnement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conditionnement.component.html',
  styleUrls: ['./conditionnement.component.css']
})
export class ConditionnementComponent implements OnInit {
  private apiService = inject(ApiService);

  activeTab = signal<'marques' | 'gammes' | 'varietes' | 'emballages' | 'configurations'>('marques');

  marques = signal<Marque[]>([]);
  gammes = signal<Gamme[]>([]);
  varietes = signal<Variete[]>([]);
  emballages = signal<TypeEmballage[]>([]);
  configurations = signal<ConfigurationConditionnement[]>([]);

  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Modals
  showCreateModal = false;
  showEditModal = false;
  selectedTab: any = null;
  selectedItem: any = null;

  // Forms
  nouvelleMarque = { code: '', nom: '', description: '', logoUrl: '' };
  nouvelleGamme = { code: '', nom: '', description: '' };
  nouvelleVariete = { code: '', nom: '', description: '', gammeId: null, marqueId: null, poidsUnitaireG: null, unitePoids: 'G' };
  nouvelEmballage = { code: '', nom: '', description: '', niveauHierarchie: 1, poidsVideG: null, materiau: '' };
  nouvelleConfig = { varieteId: null, typeEmballageId: null, quantiteUnites: 1, poidsNetG: null, referenceProduit: '', codeBarres: '', estDefault: false };

  ngOnInit() {
    this.chargerDonnees();
  }

  chargerDonnees() {
    this.chargerMarques();
    this.chargerGammes();
    this.chargerVarietes();
    this.chargerEmballages();
    this.chargerConfigurations();
  }

  chargerMarques() {
    this.apiService.get('/api/v1/conditionnement/marques').subscribe({
      next: (data: any) => this.marques.set(data),
      error: (err) => console.error('Erreur chargement marques', err)
    });
  }

  chargerGammes() {
    this.apiService.get('/api/v1/conditionnement/gammes').subscribe({
      next: (data: any) => this.gammes.set(data),
      error: (err) => console.error('Erreur chargement gammes', err)
    });
  }

  chargerVarietes() {
    this.apiService.get('/api/v1/conditionnement/varietes').subscribe({
      next: (data: any) => this.varietes.set(data),
      error: (err) => console.error('Erreur chargement variétés', err)
    });
  }

  chargerEmballages() {
    this.apiService.get('/api/v1/conditionnement/emballages').subscribe({
      next: (data: any) => this.emballages.set(data),
      error: (err) => console.error('Erreur chargement emballages', err)
    });
  }

  chargerConfigurations() {
    this.apiService.get('/api/v1/conditionnement/configurations').subscribe({
      next: (data: any) => this.configurations.set(data),
      error: (err) => console.error('Erreur chargement configurations', err)
    });
  }

  switchTab(tab: 'marques' | 'gammes' | 'varietes' | 'emballages' | 'configurations') {
    this.activeTab.set(tab);
  }

  ouvrirCreation(tab: string) {
    this.selectedTab = tab;
    this.showCreateModal = true;
  }

  ouvrirEdition(item: any, tab: string) {
    this.selectedItem = item;
    this.selectedTab = tab;
    this.showEditModal = true;
  }

  sauvegarder() {
    const tab = this.selectedTab;
    switch (tab) {
      case 'marques':
        this.creerMarque();
        break;
      case 'gammes':
        this.creerGamme();
        break;
      case 'varietes':
        this.creerVariete();
        break;
      case 'emballages':
        this.creerEmballage();
        break;
      case 'configurations':
        this.creerConfiguration();
        break;
    }
  }

  creerMarque() {
    this.apiService.post('/api/v1/conditionnement/marques', this.nouvelleMarque).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.resetForms();
        this.chargerMarques();
      },
      error: (err) => console.error('Erreur création marque', err)
    });
  }

  creerGamme() {
    this.apiService.post('/api/v1/conditionnement/gammes', this.nouvelleGamme).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.resetForms();
        this.chargerGammes();
      },
      error: (err) => console.error('Erreur création gamme', err)
    });
  }

  creerVariete() {
    this.apiService.post('/api/v1/conditionnement/varietes', this.nouvelleVariete).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.resetForms();
        this.chargerVarietes();
      },
      error: (err) => console.error('Erreur création variété', err)
    });
  }

  creerEmballage() {
    this.apiService.post('/api/v1/conditionnement/emballages', this.nouvelEmballage).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.resetForms();
        this.chargerEmballages();
      },
      error: (err) => console.error('Erreur création emballage', err)
    });
  }

  creerConfiguration() {
    this.apiService.post('/api/v1/conditionnement/configurations', this.nouvelleConfig).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.resetForms();
        this.chargerConfigurations();
      },
      error: (err) => console.error('Erreur création configuration', err)
    });
  }

  resetForms() {
    this.nouvelleMarque = { code: '', nom: '', description: '', logoUrl: '' };
    this.nouvelleGamme = { code: '', nom: '', description: '' };
    this.nouvelleVariete = { code: '', nom: '', description: '', gammeId: null, marqueId: null, poidsUnitaireG: null, unitePoids: 'G' };
    this.nouvelEmballage = { code: '', nom: '', description: '', niveauHierarchie: 1, poidsVideG: null, materiau: '' };
    this.nouvelleConfig = { varieteId: null, typeEmballageId: null, quantiteUnites: 1, poidsNetG: null, referenceProduit: '', codeBarres: '', estDefault: false };
  }

  fermerModal() {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.selectedItem = null;
    this.resetForms();
  }

  getNiveauLabel(niveau: number): string {
    const labels: Record<number, string> = {
      1: 'Sachet',
      2: 'Gaine',
      3: 'Carton',
      4: 'Palette'
    };
    return labels[niveau] || `Niveau ${niveau}`;
  }
}
