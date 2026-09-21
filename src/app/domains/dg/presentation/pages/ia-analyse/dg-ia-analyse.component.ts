import { Component, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IaService, AnalysisRequest, AnalysisResponse, SuggestionResponse, PredictiveResponse } from '../../../../../core/services/ia.service';
import { catchError, of, Subject, takeUntil } from 'rxjs';

interface AnalysisDomain {
  key: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

@Component({
  selector: 'app-dg-ia-analyse',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dg-ia-analyse.component.html',
  styleUrls: ['./dg-ia-analyse.component.css']
})
export class DgIaAnalyseComponent implements OnDestroy {
  private iaService = inject(IaService);
  private destroy$ = new Subject<void>();

  domains: AnalysisDomain[] = [
    { key: 'global', label: 'Analyse Globale', icon: 'fa-chart-pie', color: '#1A6B2A', description: 'Vue d\'ensemble 360° de l\'entreprise' },
    { key: 'stock', label: 'Stock & Inventaire', icon: 'fa-warehouse', color: '#0277D5', description: 'Niveaux, alertes, valorisation, rotation' },
    { key: 'production', label: 'Production', icon: 'fa-industry', color: '#B8860B', description: 'Lots, rendements, matières premières' },
    { key: 'commercial', label: 'Commercial', icon: 'fa-handshake', color: '#7C3AED', description: 'Ventes, classement, performance commerciaux' },
    { key: 'financier', label: 'Financier', icon: 'fa-coins', color: '#C22B2B', description: 'Trésorerie, factures, marges, recouvrement' },
  ];

  selectedDomain = signal<string>('global');
  loading = signal(false);
  result = signal<AnalysisResponse | null>(null);
  suggestions = signal<SuggestionResponse | null>(null);
  predictions = signal<PredictiveResponse | null>(null);
  errorMsg = signal('');
  iaConfigured = signal(false);
  activeTab = signal<'analysis' | 'suggestions' | 'predictions'>('analysis');

  constructor() {
    this.iaService.getStatus().pipe(
      catchError(() => of({ configured: false, model: '', service: 'TantyAI' })),
      takeUntil(this.destroy$)
    ).subscribe(s => this.iaConfigured.set(s.configured));
  }

  selectDomain(key: string): void {
    this.selectedDomain.set(key);
    this.result.set(null);
    this.suggestions.set(null);
    this.predictions.set(null);
    this.errorMsg.set('');
  }

  selectTab(tab: 'analysis' | 'suggestions' | 'predictions'): void {
    this.activeTab.set(tab);
    this.errorMsg.set('');
  }

  runAnalysis(): void {
    this.loading.set(true);
    this.errorMsg.set('');
    this.result.set(null);

    const domain = this.selectedDomain();
    const analysisType = domain === 'global' ? 'global_enterprise' : `${domain}_overview`;

    const request: Partial<AnalysisRequest> = {
      analysisType,
      domain: domain === 'global' ? 'dg' : domain,
    };

    this.iaService.autoAnalyze(request).pipe(
      catchError(() => of({
        summary: 'Analyse indisponible. Le service IA est peut-être hors ligne.',
        insights: [],
        recommendations: [],
        chartData: [],
        model: 'fallback',
        usingFallback: true
      })),
      takeUntil(this.destroy$)
    ).subscribe(resp => {
      this.result.set(resp);
      this.loading.set(false);
    });
  }

  runSuggestions(): void {
    this.loading.set(true);
    this.errorMsg.set('');
    this.suggestions.set(null);

    const domain = this.selectedDomain();
    this.iaService.autoSuggestions({
      domain: domain === 'global' ? 'dg' : domain,
      role: 'directeur général',
      maxSuggestions: 5
    }).pipe(
      catchError(() => of({
        suggestions: [],
        model: 'fallback',
        usingFallback: true
      })),
      takeUntil(this.destroy$)
    ).subscribe(resp => {
      this.suggestions.set(resp);
      this.loading.set(false);
    });
  }

  runPredictions(): void {
    this.loading.set(true);
    this.errorMsg.set('');
    this.predictions.set(null);

    this.iaService.autoPredict({
      predictionType: 'rupture_stock',
      horizonDays: 30
    }).pipe(
      catchError(() => of({
        summary: 'Prédictions indisponibles.',
        rupturePredictions: [],
        seasonalPatterns: [],
        optimizedThresholds: [],
        anomalies: [],
        model: 'fallback',
        usingFallback: true
      })),
      takeUntil(this.destroy$)
    ).subscribe(resp => {
      this.predictions.set(resp);
      this.loading.set(false);
    });
  }

  getPriorityClass(priority: string): string {
    const p = (priority || '').toUpperCase();
    if (p === 'HIGH' || p === 'HAUTE' || p === 'CRITICAL') return 'prio-high';
    if (p === 'MEDIUM' || p === 'MOYENNE') return 'prio-medium';
    return 'prio-low';
  }

  getDomainLabel(): string {
    return this.domains.find(d => d.key === this.selectedDomain())?.label ?? 'Analyse';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
