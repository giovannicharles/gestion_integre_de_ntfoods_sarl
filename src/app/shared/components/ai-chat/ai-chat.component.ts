import { Component, signal, input, output, ElementRef, ViewChild, AfterViewChecked, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IaService, ChatRequest } from '../../../core/services/ia.service';
import { catchError, of, Subject, takeUntil } from 'rxjs';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css']
})
export class AiChatComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('msgScroll') msgScroll!: ElementRef<HTMLDivElement>;

  /** Domain IA (stock, dg, commercial, production, etc.) */
  domain = input<string>('stock');

  /** Title displayed in the chat header */
  title = input<string>('Assistant IA');

  /** Subtitle / description */
  subtitle = input<string>('Posez vos questions');

  /** Accent color class: 'green' | 'gold' | 'blue' | 'red' */
  accent = input<string>('green');

  /** Initial context data to send with each message */
  contextData = input<Record<string, unknown> | null>(null);

  /** Welcome message */
  welcomeMessage = input<string>('Bonjour ! Je suis votre assistant IA. Comment puis-je vous aider ?');

  /** Quick reply suggestions */
  quickReplies = input<{ label: string; action: string }[]>([]);

  /** Emit when a quick reply is clicked (parent can navigate) */
  quickReplyAction = output<string>();

  messages = signal<ChatMessage[]>([]);
  inputText = signal('');
  isTyping = signal(false);
  iaConfigured = signal(false);

  private iaService = inject(IaService);
  private conversationHistory: { role: string; content: string }[] = [];
  private destroy$ = new Subject<void>();
  private autoContext: Record<string, unknown> | null = null;
  private autoContextLoaded = false;

  constructor() {
    this.messages.set([{
      role: 'assistant',
      content: this.welcomeMessage(),
      time: this.now()
    }]);
    this.iaService.getStatus().pipe(
      catchError(() => of({ configured: false, model: '', service: 'TantyAI' })),
      takeUntil(this.destroy$)
    ).subscribe(s => this.iaConfigured.set(s.configured));

    this.loadAutoContext();
  }

  private loadAutoContext(): void {
    this.iaService.getAutoContext().pipe(
      catchError(() => of(null)),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      if (data) {
        this.autoContext = data;
        this.autoContextLoaded = true;
      }
    });
  }

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.isTyping()) return;
    this.addMessage('user', text);
    this.inputText.set('');
    this.queryIa(text);
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  handleQuickReply(action: string): void {
    this.quickReplyAction.emit(action);
    const labels: Record<string, string> = {};
    this.quickReplies().forEach(qr => { labels[qr.action] = qr.label; });
    const label = labels[action] || action;
    this.addMessage('user', label);
    this.queryIa(label);
  }

  clearChat(): void {
    this.conversationHistory = [];
    this.messages.set([{
      role: 'assistant',
      content: this.welcomeMessage(),
      time: this.now()
    }]);
    this.loadAutoContext();
  }

  private queryIa(query: string): void {
    this.isTyping.set(true);
    this.conversationHistory.push({ role: 'user', content: query });

    const request: ChatRequest = {
      message: query,
      domain: this.domain(),
      conversationHistory: this.conversationHistory.slice(-10)
    };

    if (this.contextData()) {
      request.context = JSON.stringify(this.contextData());
    } else if (this.autoContext) {
      request.context = JSON.stringify(this.autoContext);
    }

    this.iaService.chat(request).pipe(
      catchError(() => of({
        reply: 'Désolé, je n\'ai pas pu traiter votre demande. Le service IA est peut-être indisponible.',
        model: 'fallback', usingFallback: true
      })),
      takeUntil(this.destroy$)
    ).subscribe(resp => {
      this.isTyping.set(false);
      const reply = this.cleanText(resp.reply);
      this.conversationHistory.push({ role: 'assistant', content: reply });
      this.addMessage('assistant', reply);
    });
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
    return cleaned;
  }

  private addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.update(list => [...list, { role, content, time: this.now() }]);
    setTimeout(() => this.scrollToBottom(), 50);
  }

  private scrollToBottom(): void {
    if (this.msgScroll?.nativeElement) {
      this.msgScroll.nativeElement.scrollTop = this.msgScroll.nativeElement.scrollHeight;
    }
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private now(): string {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
