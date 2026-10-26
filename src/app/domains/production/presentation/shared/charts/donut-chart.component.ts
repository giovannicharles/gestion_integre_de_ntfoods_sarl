import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Donut chart en SVG pur pour les répartitions (produits, matières premières, postes...). */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dc-wrap">
      @if (title) { <div class="dc-title">{{ title }}</div> }
      <div class="dc-row">
        <svg viewBox="0 0 120 120" class="dc-svg">
          <circle cx="60" cy="60" r="48" fill="none" [attr.stroke]="'var(--border)'" stroke-width="16" />
          @for (seg of segments(); track seg.label) {
            <circle
              cx="60" cy="60" r="48" fill="none" [attr.stroke]="seg.color" stroke-width="16"
              [attr.stroke-dasharray]="seg.dash" [attr.stroke-dashoffset]="seg.offset"
              transform="rotate(-90 60 60)" stroke-linecap="butt"
            >
              <title>{{ seg.label }} — {{ seg.pct }}%</title>
            </circle>
          }
          <text x="60" y="56" text-anchor="middle" class="dc-center-val">{{ total() }}</text>
          <text x="60" y="72" text-anchor="middle" class="dc-center-lbl">{{ unit }}</text>
        </svg>
        <div class="dc-legend">
          @for (seg of segments(); track seg.label) {
            <div class="dc-legend-item">
              <span class="dc-dot" [style.background]="seg.color"></span>
              <span class="dc-lbl">{{ seg.label }}</span>
              <span class="dc-val">{{ seg.value }} ({{ seg.pct }}%)</span>
            </div>
          }
          @empty {
            <span class="dc-empty">Aucune donnée</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dc-wrap { width: 100%; }
    .dc-title { font-size: 0.8rem; font-weight: 600; color: var(--text-muted, #667); margin-bottom: 8px; }
    .dc-row { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
    .dc-svg { width: 110px; height: 110px; flex-shrink: 0; }
    .dc-center-val { font-size: 18px; font-weight: 700; fill: var(--text); }
    .dc-center-lbl { font-size: 8px; fill: var(--text-muted, #889); }
    .dc-legend { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 140px; }
    .dc-legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--text); }
    .dc-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .dc-lbl { flex: 1; color: var(--text-muted, #667); }
    .dc-val { font-weight: 600; }
    .dc-empty { color: var(--text-muted, #889); font-size: 0.8rem; }
  `]
})
export class DonutChartComponent {
  @Input() title = '';
  @Input() unit = '';
  @Input() data: DonutSlice[] = [];

  total() {
    return this.data.reduce((s, d) => s + d.value, 0);
  }

  segments() {
    const circumference = 2 * Math.PI * 48;
    const total = this.total() || 1;
    let acc = 0;
    return this.data.filter(d => d.value > 0).map(d => {
      const pct = Math.round((d.value / total) * 100);
      const len = (d.value / total) * circumference;
      const seg = { label: d.label, value: d.value, color: d.color, pct, dash: `${len} ${circumference - len}`, offset: -acc };
      acc += len;
      return seg;
    });
  }
}
