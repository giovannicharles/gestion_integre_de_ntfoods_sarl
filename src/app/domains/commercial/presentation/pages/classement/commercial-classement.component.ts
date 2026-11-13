import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ClassementCommercialBE } from '../../../../dg/infrastructure/dg.service';
import { CommercialService } from '../../../infrastructure/commercial.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-commercial-classement',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './commercial-classement.component.html',
  styleUrls: ['./commercial-classement.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialClassementComponent implements OnInit {
  today = new Date();
  private readonly comSvc = inject(CommercialService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  commerciaux = signal<ClassementCommercialBE[]>([]);
  monId = signal<string>('');
  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;

  readonly totalCaEquipe = computed(() => this.commerciaux().reduce((acc, c) => acc + (c.caRealise || 0), 0));
  readonly totalVentesEquipe = computed(() => this.commerciaux().reduce((acc, c) => acc + (c.nbVentes || 0), 0));
  readonly topVendeur = computed(() => this.commerciaux()[0] ?? null);
  readonly topVendeurNom = computed(() => this.topVendeur()?.nomComplet || 'En attente');
  readonly topVendeurCa = computed(() => this.topVendeur()?.caRealise || 0);

  ngOnInit(): void {
    this.monId.set(this.auth.user()?.matricule ?? '');
    this.comSvc.getClassementCommerciaux().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => this.toast.error('Impossible de charger le classement'),
    });
  }

  get numeroSemaine(): string {
    const d = new Date(Date.UTC(this.today.getFullYear(), this.today.getMonth(), this.today.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semaine = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `S${semaine}-${d.getUTCFullYear()}`;
  }

  tauxRealisation(c: ClassementCommercialBE): number {
    const max = Math.max(...this.commerciaux().map(x => x.caRealise), 1);
    return Math.round((c.caRealise / max) * 100);
  }

  isEligible(c: ClassementCommercialBE): boolean {
    return this.tauxRealisation(c) >= 100;
  }

  exporterCsv(): void {
    const rows = [
      ['Rang', 'Matricule', 'Nom Complet', 'CA Realise FCFA', 'Nombre Ventes', 'Taux Realisation %', 'Eligible Prime']
    ];
    for (const c of this.commerciaux()) {
      rows.push([
        c.rang.toString(),
        c.matricule,
        c.nomComplet,
        c.caRealise.toString(),
        c.nbVentes.toString(),
        this.tauxRealisation(c).toString() + '%',
        this.isEligible(c) ? 'OUI' : 'NON'
      ]);
    }
    const csvContent = '\uFEFF' + rows.map(r => r.map(col => `"${String(col).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classement_commerciaux_${this.numeroSemaine}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Classement exporté en CSV');
  }
}
