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

  /**
   * Correction 2026-10-25 : ce filtre comparait `typeAction` (valeurs réelles de
   * `TypeActionAudit.java` : CONSULTATION, CREATION, MODIFICATION, VALIDATION,
   * SUPPRESSION_TENTATIVE, ANNULATION, IMPRESSION_EXPORT, CONNEXION, ECHEC_CONNEXION,
   * DEBLOCAGE_PRIX, AUTRE) à des libellés `INFO`/`IMPORTANT`/`ALERTE` qui n'existent nulle
   * part côté serveur — chaque bouton sauf « TOUS » vidait silencieusement la liste, et la
   * tuile « Importants » affichait toujours 0. Le niveau est maintenant dérivé ici.
   */
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
    const n = this.filtreNiveau();
    const logs = n === 'TOUS'
      ? this.auditLog()
      : this.auditLog().filter(l => this.niveauDe(l.typeAction) === n);
    // Le tri par horodatage,desc est désormais effectué côté backend.
    return logs;
  });

  nbAlertes = computed(() => this.auditLog().filter(l => !l.succes || this.niveauDe(l.typeAction) === 'ALERTE').length);
  nbImportants = computed(() => this.auditLog().filter(l => this.niveauDe(l.typeAction) === 'IMPORTANT').length);

  /** Composition manuelle en heure locale — `toISOString()` convertit en UTC et décale la date avant 01:00 (WAT). */
  private dateLocaleIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  ngOnInit(): void {
    this.auditSvc.getAuditParPeriode(
      this.dateLocaleIso(new Date(Date.now() - 86400000 * 30)),
      this.dateLocaleIso(new Date())
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
