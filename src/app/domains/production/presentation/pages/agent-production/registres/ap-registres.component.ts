import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, RegistreProductionBE } from '../../../../infrastructure/production.service';

/**
 * REGISTRES DE PRODUCTION — Agent de Production
 * GET /production/registres (AGENT_PRODUCTION) — présences,
 * postes et rendements par PPH et par jour. Consultation seule : la saisie
 * du registre est de la responsabilité du Chef de Production / Responsable
 * de Salle.
 */
@Component({
  selector: 'app-ap-registres',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './ap-registres.component.html',
  styleUrls: ['./ap-registres.component.css', '../_shared.css']
})
export class ApRegistresComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  registres = signal<RegistreProductionBE[]>([]);
  recherche = signal('');
  debut = signal(this.joursAvant(14));
  fin = signal(new Date().toISOString().split('T')[0]);

  lignesAplaties = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    return this.registres().flatMap(reg => reg.lignes.map(l => ({ ...l, date: reg.date, referencePPH: reg.referencePPH })))
      .filter(l => !r || l.nomEmploye.toLowerCase().includes(r) || l.matriculeEmploye.toLowerCase().includes(r) || l.poste.toLowerCase().includes(r));
  });

  private joursAvant(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getRegistres({ debut: this.debut(), fin: this.fin() }).subscribe({
      next: r => { this.registres.set(r); this.loading.set(false); },
      error: () => { this.registres.set([]); this.loading.set(false); }
    });
  }
}
