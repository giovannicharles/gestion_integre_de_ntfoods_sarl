import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

// ── DTOs ──────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  context?: string;
  role?: string;
}

export interface ChatResponse {
  response: string;
  sources?: string[];
  confidence?: number;
}

export interface AnalysisRequest {
  analysisType: string;
  domain?: string;
  period?: string;
  stockData?: any;
}

export interface AnalysisResponse {
  insights: string[];
  recommendations: string[];
  riskLevel: string;
  summary: string;
}

export interface MeetingReportRequest {
  title: string;
  participants: string[];
  date: string;
  keyPoints: string[];
}

export interface MeetingReportResponse {
  report: string;
  actionItems: string[];
  decisions: string[];
}

export interface SuggestionRequest {
  domain: string;
  role: string;
  maxSuggestions?: number;
  data?: any;
}

export interface SuggestionResponse {
  suggestions: {
    title: string;
    description: string;
    priority: string;
    impact: string;
  }[];
}

export interface PredictiveRequest {
  predictionType: string;
  horizonDays: number;
  domain?: string;
  stockData?: any;
}

export interface PredictiveResponse {
  predictions: {
    item: string;
    risk: string;
    probability: number;
    timeframe: string;
    recommendation: string;
  }[];
  confidence: number;
}

export interface IntelligentReportRequest {
  reportType: string;
  sections?: string[];
  focusAreas?: string[];
}

export interface IntelligentReportResponse {
  report: string;
  riskMatrix: any;
  keyFindings: string[];
  actionPlan: string[];
}

@Injectable({ providedIn: 'root' })
export class IaService {
  private readonly api = inject(ApiService);

  // ── Statut ───────────────────────────────────────────────────

  getStatus(): Observable<{ configured: boolean; model: string; service: string }> {
    return this.api.get('ia/status');
  }

  // ── Chat ─────────────────────────────────────────────────────

  chat(request: ChatRequest): Observable<ChatResponse> {
    return this.api.post<ChatResponse>('ia/chat', request);
  }

  // ── Analyse ──────────────────────────────────────────────────

  analyze(request: AnalysisRequest): Observable<AnalysisResponse> {
    return this.api.post<AnalysisResponse>('ia/analyze', request);
  }

  autoAnalyze(request?: AnalysisRequest): Observable<AnalysisResponse> {
    return this.api.post<AnalysisResponse>('ia/auto-analyze', request || {});
  }

  // ── Rapport de réunion ───────────────────────────────────────

  meetingReport(request: MeetingReportRequest): Observable<MeetingReportResponse> {
    return this.api.post<MeetingReportResponse>('ia/meeting-report', request);
  }

  // ── Suggestions ───────────────────────────────────────────────

  suggestions(request: SuggestionRequest): Observable<SuggestionResponse> {
    return this.api.post<SuggestionResponse>('ia/suggestions', request);
  }

  autoSuggestions(request?: SuggestionRequest): Observable<SuggestionResponse> {
    return this.api.post<SuggestionResponse>('ia/auto-suggestions', request || {});
  }

  // ── Prédictions ───────────────────────────────────────────────

  predict(request: PredictiveRequest): Observable<PredictiveResponse> {
    return this.api.post<PredictiveResponse>('ia/predict', request);
  }

  autoPredict(request?: PredictiveRequest): Observable<PredictiveResponse> {
    return this.api.post<PredictiveResponse>('ia/auto-predict', request || {});
  }

  // ── Rapport intelligent ────────────────────────────────────────

  intelligentReport(request: IntelligentReportRequest): Observable<IntelligentReportResponse> {
    return this.api.post<IntelligentReportResponse>('ia/intelligent-report', request);
  }

  // ── Contexte automatique ───────────────────────────────────────

  getAutoContext(): Observable<any> {
    return this.api.get('ia/auto-context');
  }

  // ── Anomalies ─────────────────────────────────────────────────

  getAnomalies(): Observable<any[]> {
    return this.api.get<any[]>('ia/anomalies');
  }
}
