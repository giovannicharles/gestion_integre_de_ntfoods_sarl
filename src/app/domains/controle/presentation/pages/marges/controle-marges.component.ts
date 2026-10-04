import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControleService, MargeProduit } from '../../../infrastructure/controle.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';

type MargeForm = { code: string; designation: string; prixVente: number; coutRevient: number; ventesMois: number };
const FORM_VIDE: MargeForm = { code: '', designation: '', prixVente: 0, coutRevient: 0, ventesMois: 0 };

@Component({
  selector: 'app-controle-marges',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './controle-marges.component.html',
  styleUrls: ['./controle-marges.component.css'],
})
export class ControleMargesComponent implements OnInit {
  fCFA = fCFA;
  Math = Math;

  private readonly svc = inject(ControleService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  saving = signal(false);
  marges = signal<MargeProduit[]>([]);
  margeTotale = computed(() => this.marges().reduce((s, m) => s + m.margeTotale, 0));

  showForm = signal(false);
  editingId = signal<number | null>(null);
  form = signal<MargeForm>({ ...FORM_VIDE });

  actualiserChamp<K extends keyof MargeForm>(champ: K, valeur: MargeForm[K]): void {
    this.form.update(f => ({ ...f, [champ]: valeur }));
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getMarges().subscribe({
      next: m => { this.marges.set(m); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  ouvrirCreation(): void {
    this.editingId.set(null);
    this.form.set({ ...FORM_VIDE });
    this.showForm.set(true);
  }

  ouvrirEdition(m: MargeProduit): void {
    this.editingId.set(m.id);
    this.form.set({ code: m.code, designation: m.designation, prixVente: m.prixVente, coutRevient: m.coutRevient, ventesMois: m.ventesMois });
    this.showForm.set(true);
  }

  fermerForm(): void {
    if (this.saving()) return;
    this.showForm.set(false);
  }

  enregistrer(): void {
    const f = this.form();
    if (!f.code.trim() || !f.designation.trim()) { this.toast.error('Le code et la désignation sont obligatoires.'); return; }
    this.saving.set(true);
    const id = this.editingId();
    const requete = id ? this.svc.modifierMargeProduit(id, f) : this.svc.creerMargeProduit(f);
    requete.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.toast.success(id ? 'Marge produit modifiée.' : 'Marge produit créée.');
        this.charger();
      },
      error: e => { this.saving.set(false); this.toast.error(extractApiError(e), 'Enregistrement impossible'); },
    });
  }
}
