import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComptableService, ObjectifCommercialBE } from '../../../infrastructure/comptable.service';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-comptable-objectifs',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './comptable-objectifs.component.html',
  styleUrls: ['./comptable-objectifs.component.css']
})
export class ComptableObjectifsComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;
  private readonly cptSvc = inject(ComptableService);

  objectifs = signal<ObjectifCommercialBE[]>([]);

  totalCA = computed(() => 0);

  totalObjectif = computed(() =>
    this.objectifs().reduce((s, o) => s + o.objectifGlobal, 0)
  );

  tauxGlobal = computed(() =>
    tauxAtteinte(this.totalCA(), this.totalObjectif())
  );

  nbAtteints = computed(() =>
    this.objectifs().filter(o => o.objectifGlobal > 0).length
  );

  ngOnInit(): void {
    const today = new Date();
    const lundi = new Date(today);
    lundi.setDate(today.getDate() - today.getDay() + 1);
    const semaineDebut = lundi.toISOString().split('T')[0];
    this.cptSvc.getObjectifsParSemaine(semaineDebut).subscribe({
      next: o => this.objectifs.set(o),
      error: () => {},
    });
  }

  progressClass(ca: number, obj: number): string {
    const t = tauxAtteinte(ca, obj);
    if (t >= 100) return 'prog-bar prog-g';
    if (t >= 75) return 'prog-bar prog-y';
    return 'prog-bar prog-r';
  }

  statutClass(ca: number, obj: number): string {
    return ca >= obj ? 'badge bg-success' : 'badge bg-orange';
  }

  cappedTaux(ca: number, obj: number): number {
    return Math.min(tauxAtteinte(ca, obj), 100);
  }
}
