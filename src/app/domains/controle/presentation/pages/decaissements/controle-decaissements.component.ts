import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComptableService, DecaissementBE } from '../../../../comptable/infrastructure/comptable.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

const TYPES_DEPENSE = [
  'SALAIRES', 'CARBURANT', 'ACHAT_MATIERE_PREMIERE', 'ACHAT_FOURNITURES',
  'MAINTENANCE_EQUIPEMENT', 'TRANSPORT', 'MARKETING', 'IMPOTS_TAXES', 'AUTRE',
] as const;

/**
 * Écran Contrôle — Décaissements (2026-10-16, confidentialité des modules).
 *
 * `/controle/decaissements` pointait jusqu'ici vers `DgDecaissementsComponent` (module DG) —
 * le Contrôleur Général se retrouvait dans l'espace de travail du DG, avec ses boutons
 * "Valider DG"/"Approuver DG" qu'il n'a de toute façon pas le droit d'actionner
 * (`@PreAuthorize hasAnyRole('DIRECTEUR_GENERAL','ADMIN')`, backend) — exactement la violation
 * déjà corrigée une fois pour Stock↔Production, reproduite ici sans avoir été détectée.
 *
 * Le rôle réel du Contrôleur Général dans ce circuit (DecaissementController) : il PROPOSE
 * (`hasAnyRole('CONTROLEUR_GENERAL','ADMIN')`) et peut ANNULER sa proposition avant exécution
 * (`hasAnyRole('DIRECTEUR_GENERAL','CONTROLEUR_GENERAL','ADMIN')`) — jamais valider/approuver,
 * qui restent strictement DG. Cet écran n'affiche donc que ces deux actions.
 */
@Component({
  selector: 'app-controle-decaissements',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './controle-decaissements.component.html',
  styleUrls: ['./controle-decaissements.component.css']
})
export class ControleDecaissementsComponent implements OnInit {
  private readonly cptSvc = inject(ComptableService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = fCFA;
  typesDepense = TYPES_DEPENSE;

  decaissements = signal<DecaissementBE[]>([]);
  loading = signal(true);
  filterStatut = signal<'all' | 'PROPOSE' | 'VALIDEE_CG' | 'VALIDEE_DG' | 'EXECUTE' | 'ANNULE'>('all');

  showForm = signal(false);
  saving = signal(false);
  form = signal({ typeDepense: 'AUTRE' as string, montantFCFA: 0, beneficiaire: '', dateDepense: this.formatDate(new Date()), motif: '' });

  showAnnuler = signal<DecaissementBE | null>(null);
  motifAnnulation = '';

  liste = computed(() => {
    const f = this.filterStatut();
    return f === 'all' ? this.decaissements() : this.decaissements().filter(d => d.statut === f);
  });
  totalPropose = computed(() => this.decaissements().filter(d => d.statut !== 'ANNULE').reduce((s, d) => s + d.montantFCFA, 0));
  nbEnCours = computed(() => this.decaissements().filter(d => !['EXECUTE', 'ANNULE'].includes(d.statut)).length);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.cptSvc.getDecaissements().subscribe({
      next: d => { this.decaissements.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private formatDate(d: Date): string {
    const yyyy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  ouvrirForm(): void {
    this.form.set({ typeDepense: 'AUTRE', montantFCFA: 0, beneficiaire: '', dateDepense: this.formatDate(new Date()), motif: '' });
    this.showForm.set(true);
  }

  majType(v: string): void { this.form.update(f => ({ ...f, typeDepense: v })); }
  majMontant(v: string | number): void { this.form.update(f => ({ ...f, montantFCFA: +v })); }
  majBeneficiaire(v: string): void { this.form.update(f => ({ ...f, beneficiaire: v })); }
  majDate(v: string): void { this.form.update(f => ({ ...f, dateDepense: v })); }
  majMotif(v: string): void { this.form.update(f => ({ ...f, motif: v })); }

  proposer(): void {
    const f = this.form();
    const matricule = this.auth.user()?.matricule ?? '';
    if (!f.montantFCFA || f.montantFCFA <= 0 || !f.beneficiaire.trim() || !f.motif.trim()) {
      this.toast.error('Montant, bénéficiaire et motif sont obligatoires.', 'Formulaire incomplet');
      return;
    }
    this.saving.set(true);
    this.cptSvc.proposerDecaissement({
      typeDepense: f.typeDepense, matriculeProposant: matricule,
      montantFCFA: f.montantFCFA, beneficiaire: f.beneficiaire.trim(),
      dateDepense: f.dateDepense, motif: f.motif.trim(),
    }).subscribe({
      next: d => {
        this.saving.set(false);
        this.showForm.set(false);
        this.decaissements.update(list => [d, ...list]);
        this.toast.success(`Décaissement ${d.numeroDecaissement} proposé — en attente de validation DG.`);
      },
      error: e => { this.saving.set(false); this.toast.error(extractApiError(e), 'Échec de la proposition'); },
    });
  }

  ouvrirAnnuler(d: DecaissementBE): void {
    this.motifAnnulation = '';
    this.showAnnuler.set(d);
  }

  confirmerAnnuler(): void {
    const d = this.showAnnuler();
    if (!d || !this.motifAnnulation.trim()) return;
    this.cptSvc.annulerDecaissement(d.numeroDecaissement, this.motifAnnulation.trim(), this.auth.user()?.matricule ?? '').subscribe({
      next: updated => {
        this.decaissements.update(list => list.map(x => x.numeroDecaissement === updated.numeroDecaissement ? updated : x));
        this.showAnnuler.set(null);
        this.toast.success('Décaissement annulé.');
      },
      error: e => this.toast.error(extractApiError(e), 'Échec de l\'annulation'),
    });
  }

  peutAnnuler(d: DecaissementBE): boolean {
    return d.statut !== 'EXECUTE' && d.statut !== 'ANNULE';
  }

  statutClass(s: string): string {
    const map: Record<string, string> = { PROPOSE: 'badge bg-orange', VALIDEE_CG: 'badge bg-orange', VALIDEE_DG: 'badge bg-neutral', EXECUTE: 'badge bg-success', ANNULE: 'badge bg-red' };
    return map[s] ?? 'badge bg-neutral';
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      PROPOSE: 'Proposé — att. DG (1)', VALIDEE_CG: 'DG (1) ✓ — att. DG (2)',
      VALIDEE_DG: 'DG (2) ✓ — att. Secrétaire', EXECUTE: 'Exécuté', ANNULE: 'Annulé',
    };
    return map[s] ?? s;
  }
}
