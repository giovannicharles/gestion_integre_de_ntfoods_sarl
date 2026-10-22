import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

/**
 * Illustration SVG dessinée à la main pour les listes vides (rapports, documents,
 * historiques...) — remplace le texte brut "Aucune donnée" par une image accueillante
 * plutôt qu'alarmante, cohérente avec la charte TANTY (tokens gris/jaune du design system).
 */
@Component({
  selector: 'app-empty-illustration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-illustrated">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <ellipse cx="60" cy="98" rx="38" ry="6" class="ei-tray-body" />
        <path d="M22 70 L36 98 L84 98 L98 70 Z" class="ei-tray-edge" />
        <path d="M22 70 L98 70" class="ei-tray-edge" />
        <rect x="42" y="30" width="36" height="46" rx="3" class="ei-doc" transform="rotate(-6 60 53)" />
        <g transform="rotate(-6 60 53)">
          <path d="M49 42 H71 M49 50 H71 M49 58 H63" class="ei-doc-line" />
        </g>
        <circle cx="90" cy="28" r="14" class="ei-accent-ring" />
        <circle cx="90" cy="28" r="3.5" class="ei-accent" />
      </svg>
      <div class="empty-illustrated-title">{{ title }}</div>
      @if (sub) { <div class="empty-illustrated-sub">{{ sub }}</div> }
    </div>
  `
})
export class EmptyIllustrationComponent {
  @Input() title = 'Rien pour le moment';
  @Input() sub = '';
}
