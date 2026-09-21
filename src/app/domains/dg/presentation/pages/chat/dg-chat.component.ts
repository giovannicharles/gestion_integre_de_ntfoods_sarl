import { Component, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AiChatComponent } from '../../../../../shared/components/ai-chat/ai-chat.component';
import { DgService } from '../../../infrastructure/dg.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-dg-chat',
  standalone: true,
  imports: [CommonModule, AiChatComponent],
  templateUrl: './dg-chat.component.html',
  styleUrls: ['./dg-chat.component.css']
})
export class DgChatComponent implements OnDestroy {
  private dgSvc = inject(DgService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  contextData = signal<Record<string, unknown> | null>(null);
  loading = signal(true);

  quickReplies = [
    { label: 'État du stock', action: 'stock' },
    { label: 'Alertes critiques', action: 'alertes' },
    { label: 'Performance commerciale', action: 'commercial' },
    { label: 'Situation financière', action: 'financier' },
    { label: 'Production du jour', action: 'production' },
    { label: 'Analyse globale', action: 'global' }
  ];

  constructor() {
    this.dgSvc.getAiContext().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.contextData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  onQuickReply(action: string): void {
    const navMap: Record<string, string> = {
      stock: '/dg/stock-dashboard',
      alertes: '/dg/alertes',
      commercial: '/dg/classement',
      financier: '/dg/decaissements',
      production: '/dg/production',
      global: '/dg/dashboard'
    };
    const route = navMap[action];
    if (route) this.router.navigate([route]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
