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
  /** 2026-11-01 : l'échec était avalé en silence (loading repassait à false sans aucun signal),
   * l'assistant s'affichait quand même, mais sans contexte entreprise, sans que le DG le sache. */
  contextError = signal(false);

  quickReplies = [
    { label: 'État du stock', action: 'stock' },
    { label: 'Alertes critiques', action: 'alertes' },
    { label: 'Performance commerciale', action: 'commercial' },
    { label: 'Situation financière', action: 'financier' },
    { label: 'Production du jour', action: 'production' },
    { label: 'Analyse globale', action: 'global' }
  ];

  constructor() {
    this.chargerContexte();
  }

  chargerContexte(): void {
    this.loading.set(true);
    this.contextError.set(false);
    this.dgSvc.getAiContext().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.contextData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.contextError.set(true);
      }
    });
  }

  // 2026-11-01 : stock/alertes/production pointaient vers des routes /dg/* inexistantes
  // (stock-dashboard, alertes, production), un clic éjectait l'utilisateur de tout le module
  // DG via la redirection générique de route inconnue. /dg/supervision agrège déjà financier +
  // production + stock en lecture seule (même destination que le reste du sidebar DG) ;
  // "alertes" y mène aussi, à la section Stock (nbAlertesActives, anomalies détaillées).
  onQuickReply(action: string): void {
    const navMap: Record<string, string> = {
      stock: '/dg/supervision',
      alertes: '/dg/supervision',
      commercial: '/dg/classement',
      financier: '/dg/decaissements',
      production: '/dg/supervision',
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
