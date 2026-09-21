import { Component, input } from '@angular/core';

export type StatCardVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
export type StatCardSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.css']
})
export class StatCardComponent {
  readonly title = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input<string>('');
  readonly variant = input<StatCardVariant>('default');
  readonly size = input<StatCardSize>('md');
  readonly trend = input<{ value: number; isPositive: boolean } | null>(null);
  readonly loading = input(false);
  readonly clickable = input(false);

  get variantClass(): string {
    const variants: Record<StatCardVariant, string> = {
      default: 'stat-card-default',
      success: 'stat-card-success',
      warning: 'stat-card-warning',
      danger: 'stat-card-danger',
      info: 'stat-card-info'
    };
    return variants[this.variant()];
  }

  get sizeClass(): string {
    const sizes: Record<StatCardSize, string> = {
      sm: 'stat-card-sm',
      md: 'stat-card-md',
      lg: 'stat-card-lg'
    };
    return sizes[this.size()];
  }

  get trendIcon(): string {
    if (!this.trend()) return '';
    return this.trend()!.isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
  }

  get trendClass(): string {
    if (!this.trend()) return '';
    return this.trend()!.isPositive ? 'trend-positive' : 'trend-negative';
  }
}
