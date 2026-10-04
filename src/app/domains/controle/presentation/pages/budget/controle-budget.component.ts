import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControleService, BudgetItem } from '../../../infrastructure/controle.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';

type BudgetForm = { poste: string; budget: number; engage: number; realise: number };
const FORM_VIDE: BudgetForm = { poste: '', budget: 0, engage: 0, realise: 0 };

@Component({
  selector: 'app-controle-budget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './controle-budget.component.html',
  styleUrls: ['./controle-budget.component.css'],
})
export class ControleBudgetComponent implements OnInit {
  fCFA = fCFA;
  Math = Math;

  private readonly svc = inject(ControleService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  saving = signal(false);
  budget = signal<BudgetItem[]>([]);
  totalBudget = computed(() => this.budget().reduce((s, b) => s + b.budget, 0));
  totalEngage = computed(() => this.budget().reduce((s, b) => s + b.engage, 0));
  totalRealise = computed(() => this.budget().reduce((s, b) => s + b.realise, 0));
  nbDepasse = computed(() => this.budget().filter(b => b.engage > b.budget).length);

  showForm = signal(false);
  editingId = signal<number | null>(null);
  form = signal<BudgetForm>({ ...FORM_VIDE });

  actualiserChamp<K extends keyof BudgetForm>(champ: K, valeur: BudgetForm[K]): void {
    this.form.update(f => ({ ...f, [champ]: valeur }));
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getBudget().subscribe({
      next: b => { this.budget.set(b); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  ouvrirCreation(): void {
    this.editingId.set(null);
    this.form.set({ ...FORM_VIDE });
    this.showForm.set(true);
  }

  ouvrirEdition(b: BudgetItem): void {
    this.editingId.set(b.id);
    this.form.set({ poste: b.poste, budget: b.budget, engage: b.engage, realise: b.realise });
    this.showForm.set(true);
  }

  fermerForm(): void {
    if (this.saving()) return;
    this.showForm.set(false);
  }

  enregistrer(): void {
    const f = this.form();
    if (!f.poste.trim()) { this.toast.error('Le poste budgétaire est obligatoire.'); return; }
    this.saving.set(true);
    const id = this.editingId();
    const requete = id ? this.svc.modifierBudget(id, f) : this.svc.creerBudget(f);
    requete.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.toast.success(id ? 'Poste budgétaire modifié.' : 'Poste budgétaire créé.');
        this.charger();
      },
      error: e => { this.saving.set(false); this.toast.error(extractApiError(e), 'Enregistrement impossible'); },
    });
  }

  pct(engage: number, budget: number): number { return budget > 0 ? Math.round((engage / budget) * 100) : 0; }
}
