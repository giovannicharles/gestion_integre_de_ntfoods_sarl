import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControleService, MargeProduit } from '../../../infrastructure/controle.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-controle-marges',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './controle-marges.component.html',
})
export class ControleMargesComponent implements OnInit {
  fCFA = fCFA;
  Math = Math;

  private readonly svc = inject(ControleService);

  marges = signal<MargeProduit[]>([]);
  margeTotale = computed(() => this.marges().reduce((s, m) => s + m.margeTotale, 0));

  ngOnInit(): void {
    this.svc.getMarges().subscribe({
      next: m => this.marges.set(m),
      error: () => {},
    });
  }
}
