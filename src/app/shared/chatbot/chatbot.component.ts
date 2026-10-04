import { Component, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatbotContext {
  module: string; // STOCK, PRODUCTION, COMMERCIAL, DG, etc.
  entityId?: string;
  entityReference?: string;
  additionalData?: Record<string, any>;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent {
  private apiService = inject(ApiService);

  // Inputs
  context = input.required<ChatbotContext>();
  position = input<'bottom-right' | 'bottom-left' | 'right' | 'left'>('bottom-right');
  title = input<string>('Assistant IA');

  // Outputs
  messageSent = output<string>();

  // Signals
  isOpen = signal<boolean>(false);
  messages = signal<ChatMessage[]>([]);
  userMessage = signal<string>('');
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  ngOnInit() {
    // Message de bienvenue contextuel
    this.addAssistantMessage(this.getWelcomeMessage());
  }

  toggleChat() {
    this.isOpen.set(!this.isOpen());
  }

  sendMessage() {
    const message = this.userMessage().trim();
    if (!message) return;

    // Ajouter message utilisateur
    this.addUserMessage(message);
    this.userMessage.set('');

    // Envoyer à l'API
    this.loading.set(true);
    this.error.set(null);

    const context = this.context();
    this.apiService.post('/api/v1/ia/chat', {
      message,
      module: context.module,
      entityId: context.entityId,
      entityReference: context.entityReference,
      additionalData: context.additionalData
    }).subscribe({
      next: (response: any) => {
        this.addAssistantMessage(response.response || response.message || 'Réponse reçue');
        this.loading.set(false);
        this.messageSent.emit(message);
      },
      error: (err) => {
        this.error.set('Erreur lors de la communication avec l\'assistant');
        this.loading.set(false);
        this.addAssistantMessage('Désolé, je n\'ai pas pu traiter votre demande. Veuillez réessayer.');
      }
    });
  }

  private addUserMessage(content: string) {
    this.messages.update(msgs => [...msgs, {
      role: 'user',
      content,
      timestamp: new Date()
    }]);
  }

  private addAssistantMessage(content: string) {
    this.messages.update(msgs => [...msgs, {
      role: 'assistant',
      content,
      timestamp: new Date()
    }]);
  }

  private getWelcomeMessage(): string {
    const context = this.context();
    const moduleNames: Record<string, string> = {
      'STOCK': 'Gestion de Stock',
      'PRODUCTION': 'Production',
      'COMMERCIAL': 'Commercial',
      'COMPTABILITE': 'Comptabilité',
      'DG': 'Direction Générale',
      'CONDITIONNEMENT': 'Conditionnement'
    };

    const moduleName = moduleNames[context.module] || context.module;
    return `Bonjour ! Je suis votre assistant IA pour le module ${moduleName}. Comment puis-je vous aider aujourd'hui ?`;
  }

  clearChat() {
    this.messages.set([]);
    this.addAssistantMessage(this.getWelcomeMessage());
  }

  handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
