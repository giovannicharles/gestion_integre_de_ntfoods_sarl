import { Component, signal, inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IaService } from '../../../infrastructure/ia.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface MessageUI { role: 'user' | 'assistant'; content: string; timestamp: Date; }

@Component({
  selector: 'app-ia-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ia-chat.component.html',
  styleUrls: ['./ia-chat.component.css'],
})
export class IaChatComponent implements AfterViewChecked {
  private readonly iaSvc = inject(IaService);
  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  messages = signal<MessageUI[]>([
    { role: 'assistant', content: "Bonjour, je suis TantyAI. Posez-moi une question sur l'activité de l'entreprise (stock, ventes, production...).", timestamp: new Date() },
  ]);
  saisie = signal('');
  loading = signal(false);
  private scrollPending = false;

  ngAfterViewChecked(): void {
    if (this.scrollPending) {
      this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this.scrollPending = false;
    }
  }

  envoyer(): void {
    const texte = this.saisie().trim();
    if (!texte || this.loading()) return;
    this.messages.update(m => [...m, { role: 'user', content: texte, timestamp: new Date() }]);
    this.saisie.set('');
    this.scrollPending = true;
    this.loading.set(true);
    this.iaSvc.chat({ message: texte }).subscribe({
      next: r => {
        this.messages.update(m => [...m, { role: 'assistant', content: r.response || 'Réponse reçue.', timestamp: new Date() }]);
        this.loading.set(false);
        this.scrollPending = true;
      },
      error: e => {
        this.messages.update(m => [...m, { role: 'assistant', content: `Désolé, une erreur est survenue : ${extractApiError(e)}`, timestamp: new Date() }]);
        this.loading.set(false);
        this.scrollPending = true;
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.envoyer();
    }
  }
}
