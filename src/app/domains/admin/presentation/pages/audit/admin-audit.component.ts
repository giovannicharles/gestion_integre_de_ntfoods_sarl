import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuditService, JournalAuditBE } from '../../../../../core/audit/audit.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule],
  templateUrl: './admin-audit.component.html',
  styleUrls: ['./admin-audit.component.css']
})
export class AdminAuditComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  private readonly auditSvc = inject(AuditService);

  auditLog = signal<JournalAuditBE[]>([]);
  filtreNiveau = signal<string>('TOUS');

  niveaux = ['TOUS', 'INFO', 'IMPORTANT', 'ALERTE'];

  logsFiltres = computed(() => {
    const n = this.filtreNiveau();
    const logs = n === 'TOUS'
      ? this.auditLog()
      : this.auditLog().filter(l => l.typeAction === n);
    // Le tri par horodatage,desc est désormais effectué côté backend.
    return logs;
  });

  nbAlertes = computed(() => this.auditLog().filter(l => !l.succes).length);
  nbImportants = computed(() => this.auditLog().filter(l => l.typeAction === 'IMPORTANT').length);

  ngOnInit(): void {
    this.auditSvc.getAuditParPeriode(
      new Date(Date.now() - 86400000 * 30).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    ).subscribe({
      next: page => this.auditLog.set(page.contenu),
      error: () => {},
    });
  }

  niveauClass(n: string): string {
    const map: Record<string, string> = {
      INFO: 'badge bg-neutral',
      IMPORTANT: 'badge bg-orange',
      ALERTE: 'badge bg-red',
    };
    return map[n] ?? 'badge bg-neutral';
  }
}
