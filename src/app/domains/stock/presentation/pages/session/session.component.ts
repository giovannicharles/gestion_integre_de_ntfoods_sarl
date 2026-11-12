import { Component, ChangeDetectionStrategy, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil, catchError, of } from 'rxjs';
import { CommercialUseCase } from '../../../application/use-cases/commercial/commercial.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { Commercial, InfoProduits, InfoProduitsLine } from '../../../domain/models';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
@Component({ selector: 'app-session', standalone: true, imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, FormsModule], templateUrl: './session.component.html', styleUrls: ['./session.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class SessionComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>(); private uc = inject(CommercialUseCase); private repo = inject(StockApiRepository);
  private toast = inject(ToastService);
  loading = signal(true); error = signal(''); infos = signal<InfoProduits[]>([]); comms = signal<Commercial[]>([]);
  today = new Date(); selectedDate = signal<string>(new Date().toISOString().split('T')[0]); activeTab = signal<'info' | 'comms'>('info');
  search = signal(''); statusFilter = signal<string>('');
  getPrise(ip: InfoProduits) { return ip.lines.reduce((a: number, l: InfoProduitsLine) => a + l.takenQty, 0); }
  getVendu(ip: InfoProduits) { return ip.lines.reduce((a: number, l: InfoProduitsLine) => a + l.soldQty, 0); }
  getRestant(ip: InfoProduits) { return ip.lines.reduce((a: number, l: InfoProduitsLine) => a + l.returnedQty, 0); }
  getTaux(ip: InfoProduits) { const p = this.getPrise(ip); return p > 0 ? Math.round((this.getVendu(ip) / p) * 100) : 0; }
  getMontant(ip: InfoProduits) { return ip.montantTotal || ip.lines.reduce((a: number, l: InfoProduitsLine) => a + (l.soldQty * (l.unitPrice || 0)), 0); }
  get totalPris() { return this.infos().reduce((a, ip) => a + this.getPrise(ip), 0); }
  get totalVendus() { return this.infos().reduce((a, ip) => a + this.getVendu(ip), 0); }
  get totalRestants() { return this.infos().reduce((a, ip) => a + this.getRestant(ip), 0); }
  get totalMontant() { return this.infos().reduce((a, ip) => a + this.getMontant(ip), 0); }
  getInfoColor(s: string) { const m: Record<string, string> = { DRAFT: 'badge-warning', PENDING_CASH: 'badge-primary', PENDING_ACCOUNTANT: 'badge-secondary', CLOSED: 'badge-success' }; return m[s] || 'badge-neutral'; }
  getInfoLabel(s: string) { const m: Record<string, string> = { DRAFT: 'Préparé', PENDING_CASH: 'Att. caissière', PENDING_ACCOUNTANT: 'Att. comptable', CLOSED: 'Clôturé' }; return m[s] || s; }
  fCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }
  load() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      i: this.uc.getInfoProduits(this.selectedDate()).pipe(catchError(() => of([]))),
      c: this.uc.getCommercials().pipe(catchError(() => of([])))
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ i, c }) => {
        this.infos.set(i);
        this.comms.set(c);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = extractApiError(err) || 'Erreur lors du chargement de la session du jour.';
        this.error.set(msg);
        this.toast.error(msg, 'Session Commerciale');
      }
    });
  }
  ngOnInit() { this.load(); }
  setDate(v: string) { this.selectedDate.set(v); this.load(); }
  shiftDate(days: number) { const d = new Date(this.selectedDate()); d.setDate(d.getDate() + days); this.setDate(d.toISOString().split('T')[0]); }
  filteredInfos() { const q = this.search().toLowerCase(); const s = this.statusFilter(); return this.infos().filter(ip => (q ? (ip.commercial?.name || ip.commercialMatricule || '').toLowerCase().includes(q) : true) && (s ? ip.status === s : true)); }
  filteredComms() { const q = this.search().toLowerCase(); return this.comms().filter(c => (c.name || '').toLowerCase().includes(q) || (c.matricule || '').toLowerCase().includes(q)); }
  getAverageTaux() { const list = this.infos(); return list.length ? Math.round(list.reduce((a, ip) => a + this.getTaux(ip), 0) / list.length) : 0; }
  getCommercialSales(mat?: string) { return this.infos().filter(ip => ip.commercialId === mat || ip.commercialMatricule === mat).reduce((a, ip) => a + this.getMontant(ip), 0); }
  printSummary() { window.print(); }

  exportSessionCsv(): void {
    const list = this.filteredInfos();
    if (list.length === 0) {
      this.toast.warning('Aucune fiche session à exporter.', 'Export CSV');
      return;
    }
    const headers = ['Commercial', 'Matricule', 'Date', 'Pris', 'Vendu', 'Retourné', 'Taux (%)', 'Montant (FCFA)', 'Statut'];
    const rows = list.map(ip => [
      `"${ip.commercial?.name || ''}"`,
      `"${ip.commercialMatricule || ip.commercialId || ''}"`,
      `"${this.selectedDate()}"`,
      this.getPrise(ip),
      this.getVendu(ip),
      this.getRestant(ip),
      this.getTaux(ip),
      Math.round(this.getMontant(ip)),
      `"${this.getInfoLabel(ip.status)}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `session_jour_${this.selectedDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.success(`${list.length} fiche(s) exportée(s) en CSV.`, 'Export CSV');
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
