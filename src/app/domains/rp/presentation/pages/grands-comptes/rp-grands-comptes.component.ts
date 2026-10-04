import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RpService, GrandCompteResponse } from '../../../infrastructure/rp.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';

type GrandCompteForm = {
  nom: string; type: string; contact: string; telephone: string;
  caMensuel: number; derniereCommande: string; prochaineRelance: string; statut: string;
};

const FORM_VIDE: GrandCompteForm = {
  nom: '', type: 'GMS', contact: '', telephone: '',
  caMensuel: 0, derniereCommande: '', prochaineRelance: '', statut: 'ACTIF',
};

@Component({
  selector: 'app-rp-grands-comptes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './rp-grands-comptes.component.html',
  styleUrls: ['./rp-grands-comptes.component.css'],
})
export class RpGrandsComptesComponent implements OnInit {
  fCFA = fCFA;
  private readonly rpSvc = inject(RpService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  saving = signal(false);
  comptes = signal<GrandCompteResponse[]>([]);

  relancesDues = computed(() => this.comptes().filter(c =>
    c.prochaineRelance && new Date(c.prochaineRelance) <= new Date()));
  caTotal = computed(() => this.comptes().reduce((s, c) => s + (c.caMensuel ?? 0), 0));

  showForm = signal(false);
  editingId = signal<number | null>(null);
  form = signal<GrandCompteForm>({ ...FORM_VIDE });

  actualiserChamp<K extends keyof GrandCompteForm>(champ: K, valeur: GrandCompteForm[K]): void {
    this.form.update(f => ({ ...f, [champ]: valeur }));
  }

  icon(type: string): string {
    return type === 'HÔTEL' || type === 'HOTEL' ? 'fa-hotel' : type === 'GMS' ? 'fa-cart-shopping' : 'fa-bread-slice';
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.rpSvc.getGrandsComptes().subscribe({
      next: c => { this.comptes.set(c); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  ouvrirCreation(): void {
    this.editingId.set(null);
    this.form.set({ ...FORM_VIDE });
    this.showForm.set(true);
  }

  ouvrirEdition(c: GrandCompteResponse): void {
    this.editingId.set(c.id);
    this.form.set({
      nom: c.nom, type: c.type, contact: c.contact, telephone: c.telephone,
      caMensuel: c.caMensuel,
      derniereCommande: c.derniereCommande ? c.derniereCommande.substring(0, 10) : '',
      prochaineRelance: c.prochaineRelance ? c.prochaineRelance.substring(0, 10) : '',
      statut: c.statut,
    });
    this.showForm.set(true);
  }

  fermerForm(): void {
    if (this.saving()) return;
    this.showForm.set(false);
  }

  enregistrer(): void {
    const f = this.form();
    if (!f.nom.trim()) { this.toast.error('Le nom du grand compte est obligatoire.'); return; }
    this.saving.set(true);
    const payload = {
      nom: f.nom.trim(), type: f.type, contact: f.contact, telephone: f.telephone,
      caMensuel: f.caMensuel || 0,
      derniereCommande: f.derniereCommande || null,
      prochaineRelance: f.prochaineRelance || null,
      statut: f.statut,
    };
    const id = this.editingId();
    const requete = id ? this.rpSvc.modifierGrandCompte(id, payload) : this.rpSvc.creerGrandCompte(payload);
    requete.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.toast.success(id ? 'Grand compte modifié.' : 'Grand compte créé.');
        this.charger();
      },
      error: e => { this.saving.set(false); this.toast.error(extractApiError(e), 'Enregistrement impossible'); },
    });
  }

  archiver(c: GrandCompteResponse): void {
    if (!confirm(`Archiver « ${c.nom} » ? Il n'apparaîtra plus dans cette liste.`)) return;
    this.rpSvc.archiverGrandCompte(c.id).subscribe({
      next: () => { this.toast.success('Grand compte archivé.'); this.charger(); },
      error: e => this.toast.error(extractApiError(e), 'Archivage impossible'),
    });
  }
}
