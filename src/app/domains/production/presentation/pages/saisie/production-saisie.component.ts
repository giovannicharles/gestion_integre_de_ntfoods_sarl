import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductionService, SessionBroyageBE, SessionDosageBE } from '../../../infrastructure/production.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-production-saisie',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './production-saisie.component.html',
  styleUrls: ['./production-saisie.component.css']
})
export class ProductionSaisieComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  private readonly prodSvc = inject(ProductionService);

  broyage = signal<SessionBroyageBE[]>([]);
  dosage = signal<SessionDosageBE[]>([]);

  showFormBroyage = signal(false);
  showFormDosage = signal(false);

  totalBroyeAujourd_hui = computed(() => {
    const today = new Date().toDateString();
    return this.broyage()
      .filter(r => new Date(r.date).toDateString() === today)
      .reduce((s, r) => s + (r.indicateursGlobaux?.totalPoudreKg ?? 0), 0);
  });

  totalFuts = computed(() => {
    const today = new Date().toDateString();
    return this.dosage()
      .filter(r => new Date(r.date).toDateString() === today)
      .reduce((s, r) => s + r.futsProduits, 0);
  });

  perteMoyenne = computed(() => 0);

  ngOnInit(): void {
    this.prodSvc.getSessionsBroyage().subscribe({
      next: b => this.broyage.set(b),
      error: () => {},
    });
    this.prodSvc.getSessionsDosageParDate(new Date().toISOString().split('T')[0]).subscribe({
      next: d => this.dosage.set(d),
      error: () => {},
    });
  }
}
