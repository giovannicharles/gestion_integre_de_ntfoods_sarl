import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ConfirmDialogVariant = 'default' | 'danger' | 'warning';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent {
  readonly isOpen = input(false);
  readonly title = input('Confirmer');
  readonly message = input('Êtes-vous sûr de vouloir continuer ?');
  readonly confirmText = input('Confirmer');
  readonly cancelText = input('Annuler');
  readonly variant = input<ConfirmDialogVariant>('default');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  get variantClass(): string {
    const variants: Record<ConfirmDialogVariant, string> = {
      default: 'confirm-default',
      danger: 'confirm-danger',
      warning: 'confirm-warning'
    };
    return variants[this.variant()];
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
