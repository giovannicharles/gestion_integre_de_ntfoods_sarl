import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductionService, LigneRegistreBE } from '../../../infrastructure/production.service';

@Component({
  selector: 'app-production-employes',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './production-employes.component.html',
  styleUrls: ['./production-employes.component.css']
})
export class ProductionEmployesComponent implements OnInit {
  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  private readonly svc = inject(ProductionService);

  employes = signal<LigneRegistreBE[]>([]);

  nbPresents = computed(() =>
    this.employes().filter(e => e.present).length
  );

  nbAbsents = computed(() =>
    this.employes().filter(e => !e.present).length
  );

  tauxPresence = computed(() => {
    const total = this.employes().length;
    if (total === 0) return 0;
    return Math.round((this.nbPresents() / total) * 100);
  });

  postesDistincts = computed(() => {
    const postes = new Set(this.employes().map(e => e.poste));
    return postes.size;
  });

  presentsSeul = computed(() =>
    this.employes().filter(e => e.present)
  );

  ngOnInit(): void {
    this.svc.getRegistres().subscribe({
      next: (registres) => {
        if (registres.length > 0) {
          const latest = registres[0];
          this.employes.set(latest.lignes);
        }
      },
      error: () => {},
    });
  }
}
