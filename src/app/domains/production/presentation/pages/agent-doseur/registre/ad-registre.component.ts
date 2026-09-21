import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionDosageBE } from '../../../../infrastructure/production.service';

/**
 * REGISTRE DE DOSAGE — Agent Doseur
 * GET /dosage/{id}/registre est bien autorisé pour AGENT_DOSEUR (téléchargement
 * fonctionnel). La LISTE des sessions à afficher dépend en revanche de
 * /dosage/periode, non autorisé — réserve identique aux autres vues.
 */
@Component({
  selector: 'app-ad-registre',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './ad-registre.component.html',
  styleUrls: ['./ad-registre.component.css', '../_shared.css']
})
export class AdRegistreComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  erreurAcces = signal(false);
  message = signal('');
  sessions = signal<SessionDosageBE[]>([]);

  recherche = signal('');
  debut = signal(this.joursAvant(14));
  fin = signal(new Date().toISOString().split('T')[0]);

  sessionsFiltrees = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    return r ? this.sessions().filter(s => s.referencePPH.toLowerCase().includes(r) || s.matriculeAgentDoseur.toLowerCase().includes(r)) : this.sessions();
  });

  private joursAvant(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.erreurAcces.set(false);
    this.svc.getSessionsDosageParPeriode(this.debut(), this.fin()).subscribe({
      next: s => { this.sessions.set(s); this.loading.set(false); },
      error: () => { this.erreurAcces.set(true); this.loading.set(false); }
    });
  }

  telecharger(s: SessionDosageBE, format: 'pdf' | 'excel'): void {
    this.svc.telechargerRegistreDosage(s.id, format).subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `registre-dosage-${s.id}.${format === 'excel' ? 'xlsx' : 'pdf'}`; a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.message.set('Erreur lors du téléchargement du registre')
    });
  }
}
