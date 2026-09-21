import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, PPHLigneDetailBE } from '../../../../infrastructure/production.service';

interface GroupeDetailsParJour {
  dateJour: string;
  lignes: PPHLigneDetailBE[];
}

/**
 * CONSULTATION DES PLANS DE PRODUCTION (PPH) — Responsable de Salle
 * Filtrage par semaine, objectifs, quantités prévues, ressources et
 * matières premières prévues (repartitionJours).
 */
@Component({
  selector: 'app-rs-plans-pph',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './rs-plans-pph.component.html',
  styleUrls: ['./rs-plans-pph.component.css', '../_shared.css']
})
export class RsPlansPphComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  pphs = signal<PPHBE[]>([]);
  filtreSemaine = signal('');
  pphSelectionne = signal<PPHBE | null>(null);

  pphsFiltres = computed(() => {
    const s = this.filtreSemaine().trim();
    return s ? this.pphs().filter(p => p.semaine.includes(s)) : this.pphs();
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs().subscribe({ next: p => { this.pphs.set(p); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  ouvrirDetail(p: PPHBE): void { this.pphSelectionne.set(p); }
  fermerDetail(): void { this.pphSelectionne.set(null); }

  detailsParJour(p: PPHBE): GroupeDetailsParJour[] {
    const map = new Map<string, PPHLigneDetailBE[]>();
    for (const l of p.lignesDetaillees ?? []) {
      const list = map.get(l.dateJour) ?? [];
      list.push(l);
      map.set(l.dateJour, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateJour, lignes]) => ({ dateJour, lignes }));
  }

  statutClass(s: string): string {
    if (s === 'CLOTURE') return 'badge bg-success';
    if (s === 'EN_COURS') return 'badge bg-orange';
    return 'badge bg-neutral';
  }
}
