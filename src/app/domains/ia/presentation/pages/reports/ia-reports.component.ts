import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IaService, MeetingReportResponse, IntelligentReportResponse } from '../../../infrastructure/ia.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

const TYPES_RAPPORT = [
  { value: 'HEBDOMADAIRE', label: 'Hebdomadaire' },
  { value: 'MENSUEL', label: 'Mensuel' },
  { value: 'INCIDENT', label: 'Incident' },
];

@Component({
  selector: 'app-ia-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ia-reports.component.html',
  styleUrls: ['./ia-reports.component.css'],
})
export class IaReportsComponent {
  private readonly iaSvc = inject(IaService);

  ongletActif = signal<'reunion' | 'intelligent'>('reunion');
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  // ── Rapport de réunion ──
  titre = signal('');
  participantsTexte = signal('');
  date = signal(new Date().toISOString().substring(0, 10));
  pointsTexte = signal('');
  resultatReunion = signal<MeetingReportResponse | null>(null);

  genererRapportReunion(): void {
    if (!this.titre().trim()) return;
    this.loading.set(true);
    this.errorMsg.set(null);
    this.resultatReunion.set(null);
    this.iaSvc.meetingReport({
      title: this.titre().trim(),
      participants: this.participantsTexte().split(',').map(p => p.trim()).filter(Boolean),
      date: this.date(),
      keyPoints: this.pointsTexte().split('\n').map(p => p.trim()).filter(Boolean),
    }).subscribe({
      next: r => { this.resultatReunion.set(r); this.loading.set(false); },
      error: e => { this.errorMsg.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  // ── Rapport intelligent ──
  types = TYPES_RAPPORT;
  reportType = signal(TYPES_RAPPORT[0].value);
  focusAreasTexte = signal('');
  resultatIntelligent = signal<IntelligentReportResponse | null>(null);

  genererRapportIntelligent(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.resultatIntelligent.set(null);
    this.iaSvc.intelligentReport({
      reportType: this.reportType(),
      focusAreas: this.focusAreasTexte().split(',').map(f => f.trim()).filter(Boolean),
    }).subscribe({
      next: r => { this.resultatIntelligent.set(r); this.loading.set(false); },
      error: e => { this.errorMsg.set(extractApiError(e)); this.loading.set(false); },
    });
  }
}
