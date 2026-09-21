import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, SessionDosageBE } from '../../../../infrastructure/production.service';
import { AdSessionContextService } from '../ad-session-context.service';

/**
 * TÉLÉCHARGEMENT DES DOCUMENTS — Agent Doseur
 *
 * ⚠️ Seuls le registre de dosage et le zip documents par session (DosageController)
 * sont accessibles à ce rôle. Cette vue liste TOUTES les sessions du jour
 * (ouvertes ET clôturées) pour permettre un téléchargement a posteriori — elle
 * ne se limite donc pas aux sessions ouvertes du contexte, mais s'aligne
 * automatiquement sur la session active si elle existe.
 */
@Component({
  selector: 'app-ad-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ad-documents.component.html',
  styleUrls: ['./ad-documents.component.css', '../_shared.css'],
})
export class AdDocumentsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly contexte = inject(AdSessionContextService);

  message = signal('');
  loading = signal(true);
  sessionsHistorique = signal<SessionDosageBE[]>([]);
  sessionSelectionnee = signal<SessionDosageBE | null>(null);
  today = this.contexte.today;

  ngOnInit(): void {
    this.loading.set(true);
    this.svc.getSessionsDosageParDate(this.today).subscribe({
      next: sessions => {
        this.sessionsHistorique.set(sessions);
        const idActif = this.contexte.sessionActiveId();
        const active = idActif ? sessions.find(s => s.id === idActif) ?? null : null;
        if (active) this.sessionSelectionnee.set(active);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectionnerSessionDepuisSelect(value: string): void {
    const id = Number(value);
    const s = this.sessionsHistorique().find(x => x.id === id) ?? null;
    this.sessionSelectionnee.set(s);
    if (s) this.contexte.definir(s.id, s.referencePPH, s.date);
  }

  telechargerRegistre(format: 'pdf' | 'excel'): void {
    const id = this.sessionSelectionnee()?.id;
    if (!id) { this.message.set('Sélectionnez une session'); return; }
    this.svc.telechargerRegistreDosage(id, format).subscribe({
      next: blob => this.declencher(blob, `registre-dosage-${id}.${format === 'excel' ? 'xlsx' : 'pdf'}`),
      error: () => this.message.set('Erreur lors du téléchargement'),
    });
  }

  telechargerDocumentsSession(): void {
    const id = this.sessionSelectionnee()?.id;
    if (!id) { this.message.set('Sélectionnez une session'); return; }
    this.svc.telechargerDocumentsDosage(id).subscribe({
      next: blob => this.declencher(blob, `documents-session-${id}.zip`),
      error: () => this.message.set('Erreur lors du téléchargement'),
    });
  }

  genererRapportJournalierCsv(): void {
    this.svc.getStatistiquesFuts(this.today, this.today).subscribe({
      next: s => {
        const csv = ['Indicateur;Valeur',
          `Fûts nets;${s.nbFutsNets}`, `Fûts produits;${s.nbFutsProduits}`,
          `Maïs (kg);${s.poudreMaisKg}`, `Soja (kg);${s.poudreSojaKg}`, `Arachide (kg);${s.poudreArachideKg}`,
          `Sessions;${s.nbSessions}`].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        this.declencher(blob, `rapport-journalier-${this.today}.csv`);
      },
      error: () => this.message.set('Erreur lors de la génération du rapport'),
    });
  }

  private declencher(blob: Blob, nom: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nom; a.click();
    window.URL.revokeObjectURL(url);
  }
}
