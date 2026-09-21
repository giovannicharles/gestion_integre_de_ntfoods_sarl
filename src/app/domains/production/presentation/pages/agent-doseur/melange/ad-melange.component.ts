import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, SessionDosageBE } from '../../../../infrastructure/production.service';

interface MelangeUI {
  session: SessionDosageBE; type: 'BOUILLIE' | 'ARACHIDE'; quantiteTotale: number;
}

/**
 * GESTION DU MÉLANGE — Agent Doseur
 *
 * ⚠️ Il n'existe pas d'entité "Mélange" indépendante côté backend : chaque
 * session de dosage EST un mélange (ses matières premières enregistrées).
 * La création se fait donc via la vue Dosage. La modification/suppression
 * d'un mélange déjà enregistré n'est pas possible : le backend n'expose
 * aucun PATCH/DELETE sur une matière déjà ajoutée à une session.
 */
@Component({
  selector: 'app-ad-melange',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './ad-melange.component.html',
  styleUrls: ['./ad-melange.component.css', '../_shared.css']
})
export class AdMelangeComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  erreurAcces = signal(false);
  sessions = signal<SessionDosageBE[]>([]);
  detail = signal<MelangeUI | null>(null);

  melanges = computed<MelangeUI[]>(() => this.sessions().map(s => {
    const soja = s.matieresUtilisees.find(m => m.typeMatiere === 'SOJA')?.quantiteKg ?? 0;
    const arachide = s.matieresUtilisees.find(m => m.typeMatiere === 'ARACHIDE')?.quantiteKg ?? 0;
    const type: 'BOUILLIE' | 'ARACHIDE' = soja >= arachide ? 'BOUILLIE' : 'ARACHIDE';
    return { session: s, type, quantiteTotale: s.matieresUtilisees.reduce((sum, m) => sum + m.quantiteKg, 0) };
  }));

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.erreurAcces.set(false);
    const debut = this.joursAvant(14);
    this.svc.getSessionsDosageParPeriode(debut, new Date().toISOString().split('T')[0]).subscribe({
      next: s => { this.sessions.set(s); this.loading.set(false); },
      error: () => { this.erreurAcces.set(true); this.loading.set(false); }
    });
  }

  private joursAvant(n: number): string {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0];
  }

  ouvrirDetail(m: MelangeUI): void { this.detail.set(m); }
  fermerDetail(): void { this.detail.set(null); }
}
