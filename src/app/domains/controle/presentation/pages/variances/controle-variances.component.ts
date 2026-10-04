import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControleService, VarianceItem } from '../../../infrastructure/controle.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

type VarianceForm = { poste: string; standard: number; reel: number; unite: string };
const FORM_VIDE: VarianceForm = { poste: '', standard: 0, reel: 0, unite: '' };

@Component({
  selector: 'app-controle-variances',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './controle-variances.component.html',
  styleUrls: ['./controle-variances.component.css'],
})
export class ControleVariancesComponent implements OnInit {
  Math = Math;

  private readonly svc = inject(ControleService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  saving = signal(false);
  variances = signal<VarianceItem[]>([]);

  nbDefavorables = computed(() => this.variances().filter(v => v.reel > v.standard).length);

  showForm = signal(false);
  editingId = signal<number | null>(null);
  form = signal<VarianceForm>({ ...FORM_VIDE });

  actualiserChamp<K extends keyof VarianceForm>(champ: K, valeur: VarianceForm[K]): void {
    this.form.update(f => ({ ...f, [champ]: valeur }));
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getVariances().subscribe({
      next: v => { this.variances.set(v); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  ecartPct(v: VarianceItem): number {
    return v.standard !== 0 ? Math.round(((v.reel - v.standard) / v.standard) * 100) : 0;
  }

  ouvrirCreation(): void {
    this.editingId.set(null);
    this.form.set({ ...FORM_VIDE });
    this.showForm.set(true);
  }

  ouvrirEdition(v: VarianceItem): void {
    this.editingId.set(v.id);
    this.form.set({ poste: v.poste, standard: v.standard, reel: v.reel, unite: v.unite });
    this.showForm.set(true);
  }

  fermerForm(): void {
    if (this.saving()) return;
    this.showForm.set(false);
  }

  enregistrer(): void {
    const f = this.form();
    if (!f.poste.trim()) { this.toast.error('Le poste est obligatoire.'); return; }
    this.saving.set(true);
    const id = this.editingId();
    const requete = id ? this.svc.modifierVariance(id, f) : this.svc.creerVariance(f);
    requete.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.toast.success(id ? 'Variance modifiée.' : 'Variance créée.');
        this.charger();
      },
      error: e => { this.saving.set(false); this.toast.error(extractApiError(e), 'Enregistrement impossible'); },
    });
  }
}
