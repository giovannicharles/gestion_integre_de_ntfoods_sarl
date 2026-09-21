import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';

export interface ChatRequest {
  message: string;
  context?: string;
  domain?: string;
  conversationHistory?: { role: string; content: string }[];
}

export interface ChatResponse {
  reply: string;
  model: string;
  usingFallback: boolean;
  suggestions?: { label: string; action: string }[];
}

export interface AnalysisRequest {
  analysisType: string;
  period?: string;
  domain?: string;
  stockData?: Record<string, unknown>;
  movementData?: Record<string, unknown>;
  alertData?: Record<string, unknown>;
  products?: Record<string, unknown>[];
}

export interface AnalysisResponse {
  summary: string;
  insights: string[];
  recommendations: { action: string; priority: string; product?: string; detail: string }[];
  chartData: { label: string; value: number; type: string }[];
  model: string;
  usingFallback: boolean;
}

export interface MeetingReportRequest {
  title: string;
  date: string;
  location?: string;
  participants?: string[];
  agenda?: string;
  notes?: string;
  decisions?: string;
  actionItems?: string;
  format?: string;
}

export interface MeetingReportResponse {
  content: string;
  formattedReport: string;
  model: string;
  usingFallback: boolean;
}

export interface SuggestionRequest {
  domain?: string;
  role?: string;
  data?: Record<string, unknown>;
  maxSuggestions?: number;
}

export interface IaSuggestion {
  title: string;
  message: string;
  category: string;
  priority: string;
  icon: string;
}

export interface SuggestionResponse {
  suggestions: IaSuggestion[];
  model: string;
  usingFallback: boolean;
}

export interface PredictiveRequest {
  domain?: string;
  predictionType?: string;
  horizonDays?: number;
  stockData?: Record<string, unknown>[];
  movementHistory?: Record<string, unknown>[];
  seasonalData?: Record<string, unknown>[];
  warehouseName?: string;
}

export interface RupturePrediction {
  productSku: string;
  productName: string;
  warehouse: string;
  daysUntilRupture: number;
  probability: number;
  severity: string;
  recommendedAction: string;
  suggestedQuantity: number;
}

export interface SeasonalPattern {
  productSku: string;
  pattern: string;
  peakMonth: string;
  lowMonth: string;
  variationPercent: number;
  recommendation: string;
}

export interface AnomalyDetection {
  type: string;
  productSku: string;
  description: string;
  severity: number;
  detectedPattern: string;
  suggestedAction: string;
}

export interface PredictiveResponse {
  summary: string;
  rupturePredictions: RupturePrediction[];
  seasonalPatterns: SeasonalPattern[];
  optimizedThresholds: Record<string, unknown>[];
  anomalies: AnomalyDetection[];
  model: string;
  usingFallback: boolean;
}

export interface IntelligentReportRequest {
  domain?: string;
  reportType?: string;
  period?: string;
  stockData?: Record<string, unknown>[];
  movementData?: Record<string, unknown>[];
  alertData?: Record<string, unknown>[];
  financialData?: Record<string, unknown>[];
  format?: string;
  includeCharts?: boolean;
  includeRecommendations?: boolean;
  includeRiskAnalysis?: boolean;
}

export interface ReportSection {
  heading: string;
  content: string;
  icon: string;
  severity: string;
}

export interface IntelligentReportResponse {
  title: string;
  executiveSummary: string;
  markdownReport: string;
  sections: ReportSection[];
  keyMetrics: Record<string, unknown>[];
  riskMatrix: Record<string, unknown>[];
  actionItems: string[];
  model: string;
  usingFallback: boolean;
}

@Injectable({ providedIn: 'root' })
export class IaService {
  private api = inject(ApiService);

  getStatus(): Observable<{ configured: boolean; model: string; service: string }> {
    return this.api.get<{ configured: boolean; model: string; service: string }>('ia/status');
  }

  chat(request: ChatRequest): Observable<ChatResponse> {
    return this.api.post<ChatResponse>('ia/chat', request);
  }

  analyze(request: AnalysisRequest): Observable<AnalysisResponse> {
    return this.api.post<AnalysisResponse>('ia/analyze', request);
  }

  generateMeetingReport(request: MeetingReportRequest): Observable<MeetingReportResponse> {
    return this.api.post<MeetingReportResponse>('ia/meeting-report', request);
  }

  exportMeetingReportPdf(request: MeetingReportRequest): Observable<Blob> {
    return this.api.postBlob('ia/meeting-report/pdf', request);
  }

  getSuggestions(request: SuggestionRequest): Observable<SuggestionResponse> {
    return this.api.post<SuggestionResponse>('ia/suggestions', request);
  }

  predict(request: PredictiveRequest): Observable<PredictiveResponse> {
    return this.api.post<PredictiveResponse>('ia/predict', request);
  }

  generateIntelligentReport(request: IntelligentReportRequest): Observable<IntelligentReportResponse> {
    return this.api.post<IntelligentReportResponse>('ia/intelligent-report', request);
  }

  getAutoContext(): Observable<Record<string, unknown>> {
    return this.api.get<Record<string, unknown>>('ia/auto-context');
  }

  getAnomalies(): Observable<Record<string, unknown>[]> {
    return this.api.get<Record<string, unknown>[]>('ia/anomalies');
  }

  autoAnalyze(request?: Partial<AnalysisRequest>): Observable<AnalysisResponse> {
    return this.api.post<AnalysisResponse>('ia/auto-analyze', request ?? {});
  }

  autoSuggestions(request?: Partial<SuggestionRequest>): Observable<SuggestionResponse> {
    return this.api.post<SuggestionResponse>('ia/auto-suggestions', request ?? {});
  }

  autoPredict(request?: Partial<PredictiveRequest>): Observable<PredictiveResponse> {
    return this.api.post<PredictiveResponse>('ia/auto-predict', request ?? {});
  }
}
