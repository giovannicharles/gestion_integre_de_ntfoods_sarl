import {
  Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef,
  signal, inject, computed
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil, catchError, of } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel, StockMovement } from '../../../domain/models';
import {
  IaService, AnalysisResponse, ChatResponse
} from '../../../../../core/services/ia.service';

Chart.register(...registerables);

interface PredictionItem {
  sku: string;
  currentQty: number;
  avgDailyConsumption: number;
  daysOfStockLeft: number;
  predictedStock30d: number;
  predictedStock60d: number;
  predictedStock90d: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  confidence: number;
  recommendation: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

@Component({
  selector: 'app-ia-predictions',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, RouterLink],
  templateUrl: './ia-predictions.component.html',
  styleUrls: ['./ia-predictions.component.css']
})
export class IaPredictionsComponent implements OnInit, AfterViewInit, OnDestroy {
  private d$ = new Subject<void>();
  private repo = inject(StockApiRepository);
  private iaService = inject(IaService);

  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('forecastCanvas') forecastCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('urgencyCanvas') urgencyCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('consumptionCanvas') consumptionCanvas!: ElementRef<HTMLCanvasElement>;
  private trendChart?: Chart;
  private forecastChart?: Chart;
  private urgencyChart?: Chart;
  private consumptionChart?: Chart;

  loading = signal(true);
  error = signal('');
  stockLevels = signal<StockLevel[]>([]);
  movements = signal<StockMovement[]>([]);
  predictions = signal<PredictionItem[]>([]);
  selectedHorizon = signal<30 | 60 | 90>(30);
  filterUrgency = signal<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  // IA Analysis state
  iaConfigured = signal(false);
  iaModel = signal('');
  iaAnalyzing = signal(false);
  iaAnalysis = signal<AnalysisResponse | null>(null);
  iaError = signal('');
  activeTab = signal<'predictions' | 'ia-analysis' | 'ia-chat'>('predictions');

  // IA Chat state
  chatMessages = signal<{ role: 'user' | 'ai'; content: string; time: string }[]>([]);
  chatInput = signal('');
  chatLoading = signal(false);
  @ViewChild('chatScroll') chatScroll?: ElementRef<HTMLDivElement>;
  @ViewChild('iaChartCanvas') iaChartCanvas?: ElementRef<HTMLCanvasElement>;
  private iaChart?: Chart;

  Math = Math;

  stats = computed(() => {
    const preds = this.predictions();
    return {
      total: preds.length,
      critical: preds.filter(p => p.urgency === 'CRITICAL').length,
      high: preds.filter(p => p.urgency === 'HIGH').length,
      reorderNeeded: preds.filter(p => p.recommendation.includes('réappro')).length,
      avgConfidence: preds.length > 0 ? Math.round(preds.reduce((s, p) => s + p.confidence, 0) / preds.length) : 0
    };
  });

  filteredPredictions = computed(() => {
    const f = this.filterUrgency();
    const preds = this.predictions();
    if (f === 'ALL') return preds;
    return preds.filter(p => p.urgency === f);
  });

  topConsumers = computed(() => {
    return [...this.predictions()].sort((a, b) => b.avgDailyConsumption - a.avgDailyConsumption).slice(0, 10);
  });

  ngOnInit(): void {
    this.loadData();
    this.checkIaStatus();
    this.initChat();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.buildCharts(), 800);
  }

  ngOnDestroy(): void {
    this.d$.next();
    this.d$.complete();
    this.trendChart?.destroy();
    this.forecastChart?.destroy();
    this.urgencyChart?.destroy();
    this.consumptionChart?.destroy();
    this.iaChart?.destroy();
  }

  private loadData(): void {
    this.loading.set(true);
    forkJoin({
      levels: this.repo.getStockLevels(),
      movements: this.repo.getMovements()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ levels, movements }) => {
        this.stockLevels.set(levels);
        this.movements.set(movements);
        this.generatePredictions(levels, movements);
        this.loading.set(false);
        setTimeout(() => this.buildCharts(), 100);
      },
      error: () => {
        this.error.set('Erreur lors du chargement des données');
        this.loading.set(false);
      }
    });
  }

  private generatePredictions(levels: StockLevel[], movements: StockMovement[]): void {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const preds: PredictionItem[] = levels.map(sl => {
      const productMovements = movements.filter(m =>
        m.productSku === sl.productSku &&
        new Date(m.requestedAt || m.createdAt || '').getTime() >= thirtyDaysAgo
      );

      const outQty = productMovements
        .filter(m => ['TRANSFER', 'ADJUSTMENT', 'TRANSFER_BUFFER_TO_MOBILE'].includes(m.type))
        .reduce((s, m) => s + m.quantity, 0);

      const inQty = productMovements
        .filter(m => ['RECEIPT', 'TRANSFER_CENTRAL_TO_BUFFER'].includes(m.type))
        .reduce((s, m) => s + m.quantity, 0);

      const avgDailyConsumption = outQty / 30;
      const daysOfStockLeft = avgDailyConsumption > 0
        ? Math.round(sl.quantity / avgDailyConsumption)
        : 999;

      const predictedStock30d = Math.max(0, sl.quantity - avgDailyConsumption * 30);
      const predictedStock60d = Math.max(0, sl.quantity - avgDailyConsumption * 60);
      const predictedStock90d = Math.max(0, sl.quantity - avgDailyConsumption * 90);

      const netTrend = inQty - outQty;
      const trend: 'UP' | 'DOWN' | 'STABLE' = netTrend > 5 ? 'UP' : netTrend < -5 ? 'DOWN' : 'STABLE';

      const confidence = productMovements.length > 10 ? 85 : productMovements.length > 5 ? 70 : productMovements.length > 0 ? 50 : 30;

      let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let recommendation = 'Stock suffisant';

      if (daysOfStockLeft <= 7) {
        urgency = 'CRITICAL';
        recommendation = 'Réapprovisionnement URGENT requis';
      } else if (daysOfStockLeft <= 15) {
        urgency = 'HIGH';
        recommendation = 'Réapprovisionnement recommandé sous 15j';
      } else if (daysOfStockLeft <= 30) {
        urgency = 'MEDIUM';
        recommendation = 'Surveiller: réappro dans 30j';
      } else if (sl.alertLevel === 'CRITIQUE') {
        urgency = 'HIGH';
        recommendation = 'Stock critique détecté - réappro requis';
      }

      return {
        sku: sl.productSku || '—',
        currentQty: sl.quantity,
        avgDailyConsumption: Math.round(avgDailyConsumption * 10) / 10,
        daysOfStockLeft,
        predictedStock30d: Math.round(predictedStock30d),
        predictedStock60d: Math.round(predictedStock60d),
        predictedStock90d: Math.round(predictedStock90d),
        trend,
        confidence,
        recommendation,
        urgency
      };
    });

    this.predictions.set(preds.sort((a, b) => a.daysOfStockLeft - b.daysOfStockLeft));
  }

  setFilterUrgency(f: string): void {
    this.filterUrgency.set(f as any);
  }

  private buildCharts(): void {
    this.buildTrendChart();
    this.buildForecastChart();
    this.buildUrgencyChart();
    this.buildConsumptionChart();
  }

  private buildTrendChart(): void {
    if (this.trendChart) { this.trendChart.destroy(); this.trendChart = undefined; }
    if (!this.trendCanvas?.nativeElement) return;

    const preds = this.predictions().slice(0, 10);
    this.trendChart = new Chart(this.trendCanvas.nativeElement.getContext('2d')!, {
      type: 'line',
      data: {
        labels: preds.map(p => p.sku),
        datasets: [
          { label: 'Stock actuel', data: preds.map(p => p.currentQty), borderColor: '#1A6B2A', backgroundColor: 'rgba(26,107,42,.1)', tension: 0.3 },
          { label: 'Prévision 30j', data: preds.map(p => p.predictedStock30d), borderColor: '#EA580C', backgroundColor: 'rgba(234,88,12,.1)', borderDash: [5,5], tension: 0.3 },
          { label: 'Prévision 60j', data: preds.map(p => p.predictedStock60d), borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,.1)', borderDash: [3,3], tension: 0.3 },
          { label: 'Prévision 90j', data: preds.map(p => p.predictedStock90d), borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,.1)', borderDash: [2,2], tension: 0.3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
        scales: { x: { ticks: { font: { size: 10 }, maxRotation: 45 } }, y: { beginAtZero: true } }
      }
    });
  }

  private buildForecastChart(): void {
    if (this.forecastChart) { this.forecastChart.destroy(); this.forecastChart = undefined; }
    if (!this.forecastCanvas?.nativeElement) return;

    const preds = this.predictions().slice(0, 8);
    this.forecastChart = new Chart(this.forecastCanvas.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: preds.map(p => p.sku),
        datasets: [
          { label: 'Stock actuel', data: preds.map(p => p.currentQty), backgroundColor: 'rgba(26,107,42,.7)', borderRadius: 6 },
          { label: 'Prévision 30j', data: preds.map(p => p.predictedStock30d), backgroundColor: 'rgba(234,88,12,.7)', borderRadius: 6 },
          { label: 'Prévision 90j', data: preds.map(p => p.predictedStock90d), backgroundColor: 'rgba(220,38,38,.7)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { x: { ticks: { font: { size: 10 }, maxRotation: 45 } }, y: { beginAtZero: true } }
      }
    });
  }

  private buildUrgencyChart(): void {
    if (this.urgencyChart) { this.urgencyChart.destroy(); this.urgencyChart = undefined; }
    if (!this.urgencyCanvas?.nativeElement) return;

    const preds = this.predictions();
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    preds.forEach(p => counts[p.urgency]++);

    this.urgencyChart = new Chart(this.urgencyCanvas.nativeElement.getContext('2d')!, {
      type: 'doughnut',
      data: {
        labels: ['Critique', 'Élevé', 'Moyen', 'Faible'],
        datasets: [{
          data: [counts.CRITICAL, counts.HIGH, counts.MEDIUM, counts.LOW],
          backgroundColor: ['#DC2626', '#EA580C', '#F59E0B', '#1A6B2A'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } } },
        cutout: '60%'
      }
    });
  }

  private buildConsumptionChart(): void {
    if (this.consumptionChart) { this.consumptionChart.destroy(); this.consumptionChart = undefined; }
    if (!this.consumptionCanvas?.nativeElement) return;

    const consumers = this.topConsumers();
    this.consumptionChart = new Chart(this.consumptionCanvas.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: consumers.map(c => c.sku),
        datasets: [{ label: 'Conso. moyenne /jour', data: consumers.map(c => c.avgDailyConsumption), backgroundColor: 'rgba(37,99,235,.7)', borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true }, y: { ticks: { font: { size: 10 } } } }
      }
    });
  }

  getUrgencyClass(u: string): string {
    const m: Record<string, string> = { CRITICAL: 'urg-critical', HIGH: 'urg-high', MEDIUM: 'urg-medium', LOW: 'urg-low' };
    return m[u] || 'urg-low';
  }

  getUrgencyIcon(u: string): string {
    const m: Record<string, string> = { CRITICAL: 'fa-circle-exclamation', HIGH: 'fa-triangle-exclamation', MEDIUM: 'fa-clock', LOW: 'fa-check-circle' };
    return m[u] || 'fa-check-circle';
  }

  getTrendIcon(t: string): string {
    return t === 'UP' ? 'fa-arrow-trend-up' : t === 'DOWN' ? 'fa-arrow-trend-down' : 'fa-minus';
  }

  getTrendColor(t: string): string {
    return t === 'UP' ? 'var(--g)' : t === 'DOWN' ? 'var(--r)' : 'var(--n400)';
  }

  formatCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }

  refresh(): void {
    this.loadData();
  }

  // ═══════════════════════════════════════════════════════════
  //  IA Integration
  // ═══════════════════════════════════════════════════════════

  private checkIaStatus(): void {
    this.iaService.getStatus().pipe(
      catchError(() => of({ configured: false, model: '', service: 'TantyAI' }))
    ).subscribe(status => {
      this.iaConfigured.set(status.configured);
      this.iaModel.set(status.model);
    });
  }

  runIaAnalysis(): void {
    if (this.iaAnalyzing()) return;
    this.iaAnalyzing.set(true);
    this.iaError.set('');

    const preds = this.predictions();
    const levels = this.stockLevels();
    const movements = this.movements();

    const stockSummary = {
      totalProducts: levels.length,
      totalQuantity: levels.reduce((s, l) => s + l.quantity, 0),
      totalValue: levels.reduce((s, l) => s + (l.stockValue || 0), 0),
      criticalCount: preds.filter(p => p.urgency === 'CRITICAL').length,
      highCount: preds.filter(p => p.urgency === 'HIGH').length,
      avgDaysOfStock: preds.length > 0
        ? Math.round(preds.reduce((s, p) => s + (p.daysOfStockLeft >= 999 ? 90 : p.daysOfStockLeft), 0) / preds.length)
        : 0
    };

    const topAtRisk = preds
      .filter(p => p.urgency === 'CRITICAL' || p.urgency === 'HIGH')
      .slice(0, 10)
      .map(p => ({ sku: p.sku, qty: p.currentQty, daysLeft: p.daysOfStockLeft, urgency: p.urgency }));

    const movementSummary = {
      total: movements.length,
      outQty: movements.filter(m => ['TRANSFER', 'ADJUSTMENT', 'TRANSFER_BUFFER_TO_MOBILE'].includes(m.type)).reduce((s, m) => s + m.quantity, 0),
      inQty: movements.filter(m => ['RECEIPT', 'TRANSFER_CENTRAL_TO_BUFFER'].includes(m.type)).reduce((s, m) => s + m.quantity, 0),
    };

    this.iaService.analyze({
      analysisType: 'STOCK_PREDICTION',
      period: '30 derniers jours',
      stockData: stockSummary,
      movementData: movementSummary,
      alertData: { critical: stockSummary.criticalCount, high: stockSummary.highCount, atRisk: topAtRisk }
    }).pipe(takeUntil(this.d$)).subscribe({
      next: (resp) => {
        const cleaned = {
          ...resp,
          summary: this.cleanText(resp.summary),
          insights: (resp.insights || []).map(i => this.cleanText(i)),
          recommendations: (resp.recommendations || []).map(r => ({
            ...r,
            action: this.cleanText(r.action),
            detail: this.cleanText(r.detail)
          }))
        };
        this.iaAnalysis.set(cleaned);
        this.iaAnalyzing.set(false);
        setTimeout(() => this.buildIaChart(), 100);
      },
      error: (err) => {
        this.iaError.set('Erreur lors de l\'analyse IA: ' + (err.message || 'connexion refusée'));
        this.iaAnalyzing.set(false);
      }
    });
  }

  private buildIaChart(): void {
    if (this.iaChart) { this.iaChart.destroy(); this.iaChart = undefined; }
    if (!this.iaChartCanvas?.nativeElement) return;
    const analysis = this.iaAnalysis();
    if (!analysis || !analysis.chartData || analysis.chartData.length === 0) return;

    const colors = ['#7C3AED', '#2563EB', '#EA580C', '#1A6B2A', '#DC2626', '#F59E0B', '#0891B2', '#8B5CF6'];
    this.iaChart = new Chart(this.iaChartCanvas.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: analysis.chartData.map(d => d.label),
        datasets: [{
          label: 'Valeur',
          data: analysis.chartData.map(d => d.value),
          backgroundColor: analysis.chartData.map((_, i) => colors[i % colors.length] + 'BB'),
          borderRadius: 6, borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10, family: 'Inter' }, maxRotation: 45 } },
          y: { beginAtZero: true, ticks: { font: { size: 11, family: 'Inter' } } }
        }
      }
    });
  }

  setTab(tab: 'predictions' | 'ia-analysis' | 'ia-chat'): void {
    this.activeTab.set(tab);
    if (tab === 'ia-analysis' && !this.iaAnalysis() && !this.iaAnalyzing()) {
      this.runIaAnalysis();
    }
    if (tab === 'ia-chat') {
      setTimeout(() => this.scrollChatToBottom(), 100);
    }
  }

  getPriorityClass(p: string): string {
    const m: Record<string, string> = { HIGH: 'urg-high', CRITICAL: 'urg-critical', MEDIUM: 'urg-medium', LOW: 'urg-low' };
    return m[p?.toUpperCase()] || 'urg-low';
  }

  private cleanText(text: string): string {
    if (!text) return '';
    let cleaned = text.trim();
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (cleaned.startsWith('```')) {
      const nl = cleaned.indexOf('\n');
      if (nl > 0) cleaned = cleaned.substring(nl + 1);
      if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
      cleaned = cleaned.trim();
    }
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.summary && typeof parsed.summary === 'string') return parsed.summary;
        if (parsed.message && typeof parsed.message === 'string') return parsed.message;
        if (typeof parsed === 'string') return parsed;
      } catch { /* not JSON */ }
    }
    return cleaned;
  }

  // ═══════════════════════════════════════════════════════════
  //  IA Chat
  // ═══════════════════════════════════════════════════════════

  private initChat(): void {
    this.chatMessages.set([{
      role: 'ai',
      content: 'Bonjour ! Je suis TantyAI, votre assistant IA pour l\'analyse de stock. ' +
        'Posez-moi des questions sur vos données, ou demandez une analyse. ' +
        (this.iaConfigured() ? '' : '(Mode hors-ligne — configurez OPENAI_API_KEY pour l\'IA complète)'),
      time: this.nowStr()
    }]);
  }

  sendChat(): void {
    const text = this.chatInput().trim();
    if (!text || this.chatLoading()) return;
    this.chatMessages.update(list => [...list, { role: 'user', content: text, time: this.nowStr() }]);
    this.chatInput.set('');
    this.chatLoading.set(true);
    setTimeout(() => this.scrollChatToBottom(), 50);

    const context = this.buildChatContext();
    const history = this.chatMessages().slice(-8).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));

    this.iaService.chat({ message: text, context, conversationHistory: history }).pipe(
      takeUntil(this.d$),
      catchError(() => of({
        reply: 'Désolé, je n\'ai pas pu traiter votre demande. Vérifiez que le backend est démarré et que la clé API est configurée.',
        model: 'fallback', usingFallback: true
      } as ChatResponse))
    ).subscribe(resp => {
      this.chatLoading.set(false);
      this.chatMessages.update(list => [...list, { role: 'ai', content: resp.reply, time: this.nowStr() }]);
      setTimeout(() => this.scrollChatToBottom(), 50);
    });
  }

  private buildChatContext(): string {
    const preds = this.predictions();
    const critical = preds.filter(p => p.urgency === 'CRITICAL');
    const high = preds.filter(p => p.urgency === 'HIGH');
    return JSON.stringify({
      totalProducts: preds.length,
      criticalCount: critical.length,
      highCount: high.length,
      topAtRisk: [...critical, ...high].slice(0, 5).map(p => ({ sku: p.sku, qty: p.currentQty, daysLeft: p.daysOfStockLeft })),
      avgConfidence: this.stats().avgConfidence
    });
  }

  onChatEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChat();
    }
  }

  private scrollChatToBottom(): void {
    if (this.chatScroll?.nativeElement) {
      this.chatScroll.nativeElement.scrollTop = this.chatScroll.nativeElement.scrollHeight;
    }
  }

  private nowStr(): string {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
