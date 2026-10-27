import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, CarburantBE, FeuillRouteBE } from '../../../infrastructure/commercial.service';
import { ToastService } from '../../../../../core/services/toast.service';

interface CarburantUI {
  id: string; commercialId: string; dateCreation: Date;
  immatriculation: string; kmCompteur: number; station: string;
  litresDemandes: number; montant: number;
  statut: string;
}

@Component({
  selector: 'app-commercial-carburant',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './commercial-carburant.component.html',
  styleUrls: ['./commercial-carburant.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialCarburantComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);
  private readonly toast = inject(ToastService);

  today = new Date();
  fiches = signal<CarburantUI[]>([]);
  loading = signal(false);
  showForm = signal(false);
  submitted = signal(false);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  form = signal({ kmCompteur: 0, litresDemandes: 0, station: '', immatriculation: '', montant: 0 });
  feuillesRoute = signal<FeuillRouteBE[]>([]);
  numeroFeuillRouteChoisi = signal<string>('');

  ngOnInit(): void {
    const matricule = this.auth.user()?.matricule;
    if (!matricule) return;
    this.loading.set(true);
    this.svc.getCarburant({ commercial: matricule }).subscribe({
      next: list => { this.fiches.set(list.map(this.mapC)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.chargerFeuillesRoute(matricule);
  }

  private chargerFeuillesRoute(matricule: string): void {
    const aujourdHui = this.today.toISOString().split('T')[0];
    this.svc.getFeuillesRouteParDate(matricule, aujourdHui).subscribe({
      next: feuilles => {
        this.feuillesRoute.set(feuilles);
        if (feuilles.length === 1) this.numeroFeuillRouteChoisi.set(feuilles[0].numeroFeuillRoute);
      },
      error: () => this.feuillesRoute.set([]),
    });
  }

  /**
   * Obligatoire côté API (CarburantController) : une demande doit référencer une feuille de
   * route réelle du jour, sinon RegleMetierException systématique — cause du 400 constaté
   * avant cette correction (P5, 2026-10-15).
   */
  peutSoumettre(): boolean {
    const f = this.form();
    return f.kmCompteur > 0 && f.litresDemandes > 0 && !!this.numeroFeuillRouteChoisi();
  }

  soumettre(): void {
    if (!this.peutSoumettre()) return;
    const f = this.form();
    const matricule = this.auth.user()?.matricule ?? '';
    this.svc.creerCarburant({
      matriculeCommercial: matricule,
      immatriculation: f.immatriculation || 'NC',
      stationPartenaire: f.station || 'NC',
      kilometrage: f.kmCompteur,
      litresDemandes: f.litresDemandes,
      montant: f.montant,
      numeroFeuillRoute: this.numeroFeuillRouteChoisi(),
    }).subscribe({
      next: c => {
        this.fiches.update(list => [this.mapC(c), ...list]);
        this.submitted.set(true);
        this.showForm.set(false);
        this.form.set({ kmCompteur: 0, litresDemandes: 0, station: '', immatriculation: '', montant: 0 });
      },
      error: () => this.toast.error('Impossible de soumettre la demande de carburant'),
    });
  }

  updateKmCompteur(v: number | string): void { this.form.update(f => ({...f, kmCompteur: +v})); }
  updateLitresDemandes(v: number | string): void { this.form.update(f => ({...f, litresDemandes: +v})); }
  updateStation(v: string): void { this.form.update(f => ({...f, station: v})); }
  updateMontant(v: number | string): void { this.form.update(f => ({...f, montant: +v})); }

  private mapC(c: CarburantBE): CarburantUI {
    return {
      id: c.referenceCarburant,
      commercialId: c.matriculeCommercial,
      dateCreation: new Date(c.date),
      immatriculation: c.immatriculation,
      kmCompteur: c.kilometrage,
      station: c.stationPartenaire,
      litresDemandes: c.litresDemandes,
      montant: c.montant,
      statut: c.statut,
    };
  }
}
