import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.css']
})
export class ModalComponent {
  readonly isOpen = input(false);
  readonly title = input('');
  readonly size = input<ModalSize>('md');
  readonly closeOnBackdrop = input(true);
  readonly closeOnEscape = input(true);
  readonly showCloseButton = input(true);

  readonly close = output<void>();

  private readonly _isAnimating = signal(false);
  readonly isAnimating = this._isAnimating.asReadonly();

  get sizeClass(): string {
    const sizes: Record<ModalSize, string> = {
      sm: 'modal-sm',
      md: 'modal-md',
      lg: 'modal-lg',
      xl: 'modal-xl',
      full: 'modal-full'
    };
    return sizes[this.size()];
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.close.emit();
    }
  }

  onEscape(event: KeyboardEvent): void {
    if (this.closeOnEscape() && event.key === 'Escape') {
      this.close.emit();
    }
  }

  onCloseClick(): void {
    this.close.emit();
  }
}
