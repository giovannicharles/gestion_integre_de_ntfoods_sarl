import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, FicheProductionBE } from '../../../../infrastructure/production.service';

/**
 * FICHES PRODUIT JOURNALIÈRES — Agent de Production
 * GET /production/fiches/pph/{ref} (AGENT_PRODUCTION) — liste
 * des fiches d'un PPH. Consultation seule : la création/correction d'une
 * fiche exige PRODUCTION_FICHE_PRODUIT_GERER, qu'AGENT_PRODUCTION ne détient
 * pas (réservée au Chef de Production).
 */
@Component({
  selector: 'app-ap-fiches',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ap-fiches.component.html',
  styleUrls: ['./ap-fiches.component.css', '../_shared.css']
})
export class ApFichesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  pphs = signal<PPHBE[]>([]);
  referencePPH = '';
  fiches = signal<FicheProductionBE[]>([]);
  ficheOuverte = signal<FicheProductionBE | null>(null);

  ngOnInit(): void {
    this.svc.getPPHs().subscribe({
      next: p => {
        this.pphs.set(p);
        if (p.length) { this.referencePPH = p[0].referencePPH; this.charger(); }
        else this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  charger(): void {
    if (!this.referencePPH) return;
    this.loading.set(true);
    this.svc.getFichesParPPH(this.referencePPH).subscribe({
      next: f => { this.fiches.set(f); this.loading.set(false); },
      error: () => { this.fiches.set([]); this.loading.set(false); }
    });
  }

  ouvrir(f: FicheProductionBE): void { this.ficheOuverte.set(f); }
  fermer(): void { this.ficheOuverte.set(null); }
}
