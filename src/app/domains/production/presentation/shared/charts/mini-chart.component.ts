import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

/**
 * Graphique barres/lignes en SVG pur — aucune dépendance externe (pas de recharts/chart.js
 * à installer côté projet). Supporte une ou plusieurs séries (ex: Prévu vs Réalisé,
 * Semaine N vs Semaine N-1). Couleurs pilotées par les variables CSS existantes.
 */
@Component({
  selector: 'app-mini-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mc-wrap">
      @if (title()) { <div class="mc-title">{{ title() }}</div> }
      <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" class="mc-svg" preserveAspectRatio="xMidYMid meet">
        <!-- lignes de repère horizontales -->
        @for (g of gridLines(); track $index) {
          <line [attr.x1]="padLeft" [attr.x2]="width() - padRight" [attr.y1]="g.y" [attr.y2]="g.y" class="mc-grid" />
          <text [attr.x]="padLeft - 6" [attr.y]="g.y + 3" class="mc-axis-label" text-anchor="end">{{ g.label }}</text>
        }

        @if (type() === 'bar') {
          @for (grp of barGroups(); track grp.index) {
            @for (bar of grp.bars; track bar.seriesIndex) {
              <rect
                [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.w" [attr.height]="bar.h"
                [attr.fill]="bar.color" rx="3"
              >
                <title>{{ bar.seriesName }} — {{ labels()[grp.index] }} : {{ bar.value }}</title>
              </rect>
            }
            <text [attr.x]="grp.centerX" [attr.y]="height() - padBottom + 16" class="mc-axis-label" text-anchor="middle">{{ labels()[grp.index] }}</text>
          }
        }

        @if (type() === 'line') {
          @for (s of linePaths(); track s.name) {
            <polyline [attr.points]="s.points" fill="none" [attr.stroke]="s.color" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
            @for (pt of s.dots; track pt.x) {
              <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5" [attr.fill]="s.color">
                <title>{{ s.name }} — {{ pt.label }} : {{ pt.value }}</title>
              </circle>
            }
          }
          @for (lbl of labels(); track $index) {
            <text [attr.x]="xForIndex($index)" [attr.y]="height() - padBottom + 16" class="mc-axis-label" text-anchor="middle">{{ lbl }}</text>
          }
        }
      </svg>
      @if (series().length > 1) {
        <div class="mc-legend">
          @for (s of series(); track s.name) {
            <span class="mc-legend-item"><span class="mc-dot" [style.background]="s.color"></span>{{ s.name }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .mc-wrap { width: 100%; }
    .mc-title { font-size: 0.8rem; font-weight: 600; color: var(--text-muted, #667); margin-bottom: 6px; }
    .mc-svg { width: 100%; height: auto; display: block; }
    .mc-grid { stroke: var(--border); stroke-width: 1; stroke-dasharray: 3 3; }
    .mc-axis-label { font-size: 9px; fill: var(--text-muted, #889); font-family: inherit; }
    .mc-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; }
    .mc-legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: var(--text-muted, #667); }
    .mc-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  `]
})
export class MiniChartComponent {
  type = input<'bar' | 'line'>('bar');
  title = input('');
  labels = input<string[]>([]);
  series = input<ChartSeries[]>([]);
  width = input(560);
  height = input(220);

  readonly padLeft = 34;
  readonly padRight = 12;
  readonly padTop = 14;
  readonly padBottom = 26;

  private maxValue = computed(() => {
    const all = this.series().flatMap(s => s.values);
    const max = all.length ? Math.max(...all) : 0;
    return max <= 0 ? 1 : max;
  });

  gridLines = computed(() => {
    const max = this.maxValue();
    const steps = 4;
    const usableH = this.height() - this.padTop - this.padBottom;
    const lines = [];
    for (let i = 0; i <= steps; i++) {
      const v = (max / steps) * (steps - i);
      const y = this.padTop + (usableH / steps) * i;
      lines.push({ y, label: this.formatNum(v) });
    }
    return lines;
  });

  private formatNum(v: number): string {
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return Math.round(v).toString();
  }

  private yForValue(v: number): number {
    const max = this.maxValue();
    const usableH = this.height() - this.padTop - this.padBottom;
    return this.padTop + usableH - (v / max) * usableH;
  }

  xForIndex(i: number): number {
    const n = this.labels().length;
    const usableW = this.width() - this.padLeft - this.padRight;
    if (n <= 1) return this.padLeft + usableW / 2;
    return this.padLeft + (usableW / (n - 1)) * i;
  }

  barGroups = computed(() => {
    const n = this.labels().length;
    if (n === 0) return [] as { index: number; centerX: number; bars: { seriesIndex: number; seriesName: string; color: string; value: number; x: number; y: number; w: number; h: number }[] }[];
    const usableW = this.width() - this.padLeft - this.padRight;
    const groupW = usableW / n;
    const seriesCount = Math.max(this.series().length, 1);
    const barW = Math.min(28, (groupW * 0.7) / seriesCount);
    return this.labels().map((_, index) => {
      const groupStart = this.padLeft + groupW * index + (groupW - barW * seriesCount) / 2;
      const bars = this.series().map((s, si) => {
        const value = s.values[index] ?? 0;
        const y = this.yForValue(value);
        return {
          seriesIndex: si, seriesName: s.name, color: s.color, value,
          x: groupStart + si * barW, y, w: barW - 2, h: (this.height() - this.padBottom) - y,
        };
      });
      return { index, centerX: this.padLeft + groupW * index + groupW / 2, bars };
    });
  });

  linePaths = computed(() => {
    return this.series().map(s => {
      const dots = s.values.map((v, i) => ({ x: this.xForIndex(i), y: this.yForValue(v), value: v, label: this.labels()[i] }));
      return { name: s.name, color: s.color, points: dots.map(d => `${d.x},${d.y}`).join(' '), dots };
    });
  });
}
