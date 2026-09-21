import { Component, input } from '@angular/core';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-badge',
  standalone: true,
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.css']
})
export class BadgeComponent {
  readonly text = input.required<string>();
  readonly variant = input<BadgeVariant>('default');
  readonly size = input<BadgeSize>('md');
  readonly icon = input<string>('');
  readonly dot = input(false);

  get variantClass(): string {
    const variants: Record<BadgeVariant, string> = {
      default: 'badge-default',
      success: 'badge-success',
      warning: 'badge-warning',
      danger: 'badge-danger',
      info: 'badge-info',
      neutral: 'badge-neutral'
    };
    return variants[this.variant()];
  }

  get sizeClass(): string {
    const sizes: Record<BadgeSize, string> = {
      sm: 'badge-sm',
      md: 'badge-md',
      lg: 'badge-lg'
    };
    return sizes[this.size()];
  }
}
