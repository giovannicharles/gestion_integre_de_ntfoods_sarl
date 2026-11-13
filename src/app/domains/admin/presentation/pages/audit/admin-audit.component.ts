import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuditService, JournalAuditBE, ActiviteSuspecteBE } from '../../../../../core/audit/audit.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule],
  templateUrl: './admin-audit.component.html',
  styleUrls: ['./admin-audit.component.css']
})
export class AdminAuditComponent implements OnInit {
  today = new Date();
  private readonly auditSvc = inject(AuditService);
  private readonly toast = inject(ToastService);

  auditLog = signal<JournalAuditBE[]>([]);
  activitesSuspectes = signal<ActiviteSuspecteBE[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  filtreNiveau = signal<string>('TOUS');
  filtreModule = signal<string>('TOUS');
  filtreTexte = signal<string>('');
  filtrePeriode = signal<'24H' | '7J' | '30J'>('30J');

  selectedLog = signal<JournalAuditBE | null>(null);

  niveaux = ['TOUS', 'INFO', 'IMPORTANT', 'ALERTE'];
  modules = [
    'TOUS', 'AUTH', 'STOCK', 'PRODUCTION', 'COMMERCIAL',
    'COMMERCIALISATION', 'COMPTABILITE', 'ADMINISTRATION',
    'INCIDENT', 'DG', 'SYSTEM'
  ];

  niveauDe(typeAction: string): 'INFO' | 'IMPORTANT' | 'ALERTE' {
    if (typeAction === 'SUPPRESSION_TENTATIVE' || typeAction === 'ECHEC_CONNEXION' || typeAction === 'DEBLOCAGE_PRIX') {
      return 'ALERTE';
    }
    if (typeAction === 'CREATION' || typeAction === 'MODIFICATION' || typeAction === 'VALIDATION' || typeAction === 'ANNULATION') {
      return 'IMPORTANT';
    }
    return 'INFO';
  }

  logsFiltres = computed(() => {
    const niv = this.filtreNiveau();
    const mod = this.filtreModule();
    const txt = this.filtreTexte().trim().toLowerCase();

    let logs = this.auditLog();

    if (niv !== 'TOUS') {
      logs = logs.filter(l => this.niveauDe(l.typeAction) === niv);
    }

    if (mod !== 'TOUS') {
      logs = logs.filter(l => (l.module || '').toUpperCase() === mod);
    }

    if (txt) {
      logs = logs.filter(l =>
        (l.matricule || '').toLowerCase().includes(txt) ||
        (l.details || '').toLowerCase().includes(txt) ||
        (l.adresseIp || '').toLowerCase().includes(txt) ||
        (l.typeAction || '').toLowerCase().includes(txt) ||
        (l.ressource || '').toLowerCase().includes(txt) ||
        (l.referenceEntite || '').toLowerCase().includes(txt)
      );
    }

    return logs;
  });

  nbAlertes = computed(() => this.auditLog().filter(l => !l.succes || this.niveauDe(l.typeAction) === 'ALERTE').length);
  nbImportants = computed(() => this.auditLog().filter(l => this.niveauDe(l.typeAction) === 'IMPORTANT').length);
  nbTotal = computed(() => this.auditLog().length);

  private dateLocaleIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  ngOnInit(): void {
    this.charger();
  }

  changerPeriode(p: '24H' | '7J' | '30J'): void {
    this.filtrePeriode.set(p);
    this.charger();
  }

  setFiltreNiveau(n: string): void {
    if (this.filtreNiveau() === n && n !== 'TOUS') {
      this.filtreNiveau.set('TOUS');
    } else {
      this.filtreNiveau.set(n);
    }
  }

  charger(): void {
    this.loading.set(true);
    this.error.set(null);

    const jours = this.filtrePeriode() === '24H' ? 1 : this.filtrePeriode() === '7J' ? 7 : 30;
    const dateDebut = this.dateLocaleIso(new Date(Date.now() - 86400000 * jours));
    const dateFin = this.dateLocaleIso(new Date());

    this.auditSvc.getAuditParPeriode(dateDebut, dateFin, { size: 200, sort: 'horodatage,desc' }).subscribe({
      next: page => {
        this.auditLog.set(page.contenu);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractApiError(err));
        this.loading.set(false);
      }
    });

    // Surveillance des anomalies et comportements suspects
    this.auditSvc.getActivitesSuspectes(24, 4).subscribe({
      next: res => this.activitesSuspectes.set(res),
      error: () => {}
    });
  }

  ouvrirDetails(log: JournalAuditBE): void {
    this.selectedLog.set(log);
  }

  fermerDetails(): void {
    this.selectedLog.set(null);
  }

  exporterCsv(): void {
    const list = this.logsFiltres();
    if (!list.length) {
      this.toast.info('Aucun événement à exporter.');
      return;
    }

    const headers = ['Horodatage', 'Matricule', 'Role', 'Type Action', 'Module', 'Ressource', 'Reference', 'Methode HTTP', 'Endpoint', 'Statut', 'Duree (ms)', 'Adresse IP', 'Details'];
    const rows = list.map(l => [
      `"${l.horodatage}"`,
      `"${l.matricule}"`,
      `"${l.role}"`,
      `"${l.typeAction}"`,
      `"${l.module}"`,
      `"${l.ressource || ''}"`,
      `"${l.referenceEntite || ''}"`,
      `"${l.methodeHttp || ''}"`,
      `"${l.endpoint || ''}"`,
      l.succes ? 'SUCCES' : 'ECHEC',
      l.dureeMs || 0,
      `"${l.adresseIp || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `journal_audit_tanty_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.toast.success(`${list.length} événement(s) exporté(s) en CSV.`);
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
