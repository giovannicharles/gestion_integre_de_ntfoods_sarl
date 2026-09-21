import { Component, signal, ElementRef, ViewChild, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/http/api.service';
import { IaService } from '../../../core/services/ia.service';
import { catchError, of } from 'rxjs';

interface BotMessage {
  role: 'user' | 'bot';
  content: string;
  time: string;
  quickReplies?: { label: string; action: string }[];
}

@Component({
  selector: 'app-tantybot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tantybot.component.html',
  styleUrls: ['./tantybot.component.css']
})
export class TantybotComponent implements AfterViewChecked {
  @ViewChild('msgScroll') msgScroll!: ElementRef<HTMLDivElement>;

  isOpen = signal(false);
  isTyping = signal(false);
  messages = signal<BotMessage[]>([]);
  input = signal('');
  unreadBadge = signal(0);

  private api = inject(ApiService);
  private router = inject(Router);
  private iaService = inject(IaService);
  private iaConfigured = signal(false);
  private conversationHistory: { role: string; content: string }[] = [];

  constructor() {
    this.messages.set([{
      role: 'bot',
      content: 'Bonjour ! Je suis TantyBot, votre assistant IA TANTY ERP. Je peux analyser votre stock, répondre à vos questions et vous guider. Comment puis-je vous aider ?',
      time: this.now(),
      quickReplies: [
        { label: 'Voir le stock', action: 'stock' },
        { label: 'Alertes actives', action: 'alertes' },
        { label: 'Prédictions IA', action: 'ia' },
        { label: 'Rapports', action: 'rapports' }
      ]
    }]);
    this.iaService.getStatus().pipe(
      catchError(() => of({ configured: false, model: '', service: 'TantyAI' }))
    ).subscribe(s => this.iaConfigured.set(s.configured));
  }

  toggle(): void {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.unreadBadge.set(0);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  send(): void {
    const text = this.input().trim();
    if (!text) return;
    this.addMessage('user', text);
    this.input.set('');
    this.processQuery(text);
  }

  sendQuick(action: string): void {
    const labels: Record<string, string> = {
      stock: 'Voir le stock',
      alertes: 'Voir les alertes',
      dotation: 'Créer une dotation',
      ia: 'Prédictions IA',
      valorisation: 'Valorisation du stock',
      rapports: 'Générer un rapport',
      mouvements: 'Mouvements de stock',
      dashboard: 'Tableau de bord'
    };
    this.addMessage('user', labels[action] || action);
    this.processQuery(action);
  }

  private processQuery(query: string): void {
    this.isTyping.set(true);
    const q = query.toLowerCase();

    const navKeywords = ['dotation', 'valor', 'rapport', 'report', 'mouvement', 'dashboard', 'tableau', 'ia', 'prédiction', 'prediction', 'prévision', 'prevision'];
    const isNavQuery = navKeywords.some(kw => q.includes(kw));
    const isGreeting = q.includes('bonjour') || q.includes('salut') || q.includes('hello') || q.includes('hi');
    const isHelp = q.includes('aide') || q.includes('help');
    const isThanks = q.includes('merci') || q.includes('thanks');

    if (isGreeting || isHelp || isThanks) {
      setTimeout(() => {
        this.isTyping.set(false);
        if (isGreeting) {
          this.reply('Bonjour ! Je peux analyser votre stock, répondre à vos questions et vous guider. Que souhaitez-vous faire ?',
            [{ label: 'Voir le stock', action: 'stock' }, { label: 'Alertes', action: 'alertes' }, { label: 'Prédictions IA', action: 'ia' }]);
        } else if (isHelp) {
          this.reply('Je peux vous aider avec :\n• État du stock\n• Alertes actives\n• Prédictions IA\n• Rapports et exports\n• Mouvements de stock\n• Analyse IA de vos données\n\nPosez-moi une question ou choisissez une option.',
            [{ label: 'Voir le stock', action: 'stock' }, { label: 'Alertes', action: 'alertes' }, { label: 'Prédictions IA', action: 'ia' }, { label: 'Rapports', action: 'rapports' }]);
        } else {
          this.reply('Avec plaisir ! N\'hésitez pas si vous avez d\'autres questions.');
        }
      }, 400);
      return;
    }

    if (q.includes('stock') && !q.includes('mouvement') && !q.includes('valor')) {
      this.fetchStockSummary();
    } else if (q.includes('alerte')) {
      this.fetchAlertSummary();
    } else if (isNavQuery) {
      setTimeout(() => {
        this.isTyping.set(false);
        if (q.includes('dotation')) {
          this.reply('Pour créer une dotation, accédez au module Dotations.', [{ label: 'Aller aux dotations', action: 'dotation' }]);
        } else if (q.includes('ia') || q.includes('prédiction') || q.includes('prediction') || q.includes('prévision') || q.includes('prevision')) {
          this.reply('Le module IA Prédictions analyse vos mouvements de stock pour prévoir les ruptures et recommander des réapprovisionnements.', [{ label: 'Ouvrir IA Prédictions', action: 'ia' }]);
        } else if (q.includes('valor')) {
          this.reply('La valorisation calcule la valeur de votre stock en utilisant les prix produits.', [{ label: 'Voir la valorisation', action: 'valorisation' }]);
        } else if (q.includes('rapport') || q.includes('report')) {
          this.reply('Générez des rapports PDF/Excel avec graphiques depuis le module Rapports. Comptes-rendus de réunions IA également disponibles.', [{ label: 'Aller aux rapports', action: 'rapports' }]);
        } else if (q.includes('mouvement')) {
          this.reply('Les mouvements de stock sont tracés dans le module Mouvements avec audit trail complet.', [{ label: 'Voir les mouvements', action: 'mouvements' }]);
        } else if (q.includes('dashboard') || q.includes('tableau')) {
          this.reply('Le tableau de bord affiche les KPIs en temps réel.', [{ label: 'Ouvrir le dashboard', action: 'dashboard' }]);
        }
      }, 400);
    } else {
      this.queryIa(query);
    }
  }

  private queryIa(query: string): void {
    this.isTyping.set(true);
    this.conversationHistory.push({ role: 'user', content: query });

    this.iaService.chat({
      message: query,
      conversationHistory: this.conversationHistory.slice(-10)
    }).pipe(
      catchError(() => of({
        reply: 'Désolé, je n\'ai pas pu traiter votre demande. Le service IA est peut-être indisponible. Tapez "aide" pour voir les options disponibles.',
        model: 'fallback', usingFallback: true
      }))
    ).subscribe(resp => {
      this.isTyping.set(false);
      this.conversationHistory.push({ role: 'assistant', content: resp.reply });
      this.reply(resp.reply, [{ label: 'Voir le stock', action: 'stock' }, { label: 'Prédictions IA', action: 'ia' }]);
    });
  }

  private fetchStockSummary(): void {
    this.isTyping.set(true);
    this.api.get<any>('v1/stock/dashboard/stats').subscribe({
      next: (data: any) => {
        this.isTyping.set(false);
        const totalProducts = data?.totalProducts ?? '—';
        const totalValue = data?.totalStockValue ?? 0;
        const lowStock = data?.lowStockCount ?? 0;
        const msg = `📊 État du stock :\n• Produits : ${totalProducts}\n• Valeur totale : ${this.formatCFA(totalValue)}\n• Alertes stock bas : ${lowStock}`;
        this.reply(msg, [{ label: 'Voir le détail', action: 'stock' }, { label: 'Alertes', action: 'alertes' }]);
      },
      error: () => {
        this.isTyping.set(false);
        this.reply('Impossible de récupérer les données du stock pour le moment. Vérifiez que le serveur backend est démarré.',
          [{ label: 'Tableau de bord', action: 'dashboard' }]);
      }
    });
  }

  private fetchAlertSummary(): void {
    this.isTyping.set(true);
    this.api.get<any[]>('stock/alerts/active/priority').subscribe({
      next: (alerts: any[]) => {
        this.isTyping.set(false);
        const active = alerts.filter((a: any) => a.status === 'ACTIVE');
        const critical = active.filter((a: any) => a.priority === 'CRITICAL');
        const msg = `⚠️ Alertes :\n• Total : ${alerts.length}\n• Actives : ${active.length}\n• Critiques : ${critical.length}`;
        this.reply(msg, [{ label: 'Voir les alertes', action: 'alertes' }]);
      },
      error: () => {
        this.isTyping.set(false);
        this.reply('Impossible de récupérer les alertes pour le moment.',
          [{ label: 'Voir les alertes', action: 'alertes' }]);
      }
    });
  }

  private reply(content: string, quickReplies?: { label: string; action: string }[]): void {
    this.addMessage('bot', content, quickReplies);
    if (!this.isOpen()) {
      this.unreadBadge.update(v => v + 1);
    }
  }

  private addMessage(role: 'user' | 'bot', content: string, quickReplies?: { label: string; action: string }[]): void {
    this.messages.update(list => [...list, { role, content, time: this.now(), quickReplies }]);
    setTimeout(() => this.scrollToBottom(), 50);
  }

  private scrollToBottom(): void {
    if (this.msgScroll?.nativeElement) {
      this.msgScroll.nativeElement.scrollTop = this.msgScroll.nativeElement.scrollHeight;
    }
  }

  ngAfterViewChecked(): void {
    if (this.isOpen()) this.scrollToBottom();
  }

  handleQuickReply(action: string): void {
    const navMap: Record<string, string> = {
      stock: '/stock/articles',
      alertes: '/stock/alertes',
      dotation: '/stock/dotations',
      ia: '/stock/ia-predictions',
      valorisation: '/stock/valorisation',
      rapports: '/stock/rapports',
      mouvements: '/stock/mouvements',
      dashboard: '/stock/dashboard'
    };
    if (action === 'aide') {
      this.sendQuick('aide');
      return;
    }
    const route = navMap[action];
    if (route) {
      this.router.navigate([route]);
      this.isOpen.set(false);
    }
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private now(): string {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  private formatCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }
}
