import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IaService, SuggestionResponse } from '../../../infrastructure/ia.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

const DOMAINES = [
  { value: 'STOCK', label: 'Stock' },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'FINANCE', label: 'Finance' },
];

const ROLES = [
  { value: 'GESTIONNAIRE_STOCK', label: 'Gestionnaire de stock' },
  { value: 'CHEF_PRODUCTION', label: 'Chef de production' },
  { value: 'DIRECTEUR_GENERAL', label: 'Directeur Général' },
  { value: 'CONTROLEUR_GENERAL', label: 'Contrôleur général' },
  { value: 'COMPTABLE', label: 'Comptable' },
];

@Component({
  selector: 'app-ia-suggestions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ia-suggestions.component.html',
  styleUrls: ['./ia-suggestions.component.css'],
})
export class IaSuggestionsComponent {
  private readonly iaSvc = inject(IaService);

  domaines = DOMAINES;
  roles = ROLES;
  domain = signal(DOMAINES[0].value);
  role = signal(ROLES[0].value);
  maxSuggestions = signal(5);

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  resultat = signal<SuggestionResponse | null>(null);

  demanderSuggestions(auto: boolean): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.resultat.set(null);
    const req = { domain: this.domain(), role: this.role(), maxSuggestions: this.maxSuggestions() || 5 };
    const obs$ = auto ? this.iaSvc.autoSuggestions(req) : this.iaSvc.suggestions(req);
    obs$.subscribe({
      next: r => { this.resultat.set(r); this.loading.set(false); },
      error: e => { this.errorMsg.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  prioriteClass(priorite: string): string {
    const p = (priorite || '').toUpperCase();
    if (p.includes('HAUT') || p.includes('URGENT') || p.includes('HIGH')) return 'badge bg-red';
    if (p.includes('MOYEN') || p.includes('MEDIUM')) return 'badge bg-orange';
    return 'badge bg-success';
  }
}
