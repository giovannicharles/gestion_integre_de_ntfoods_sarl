import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductionService, SessionBroyageBE, SessionDosageBE, AffectationBE } from '../../../infrastructure/production.service';

@Component({
  selector: 'app-production-saisie',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './production-saisie.component.html',
  styleUrls: ['./production-saisie.component.css']
})
export class ProductionSaisieComponent implements OnInit {
  today = new Date();
  private readonly prodSvc = inject(ProductionService);

  broyage = signal<SessionBroyageBE[]>([]);
  dosage = signal<SessionDosageBE[]>([]);
  affectations = signal<AffectationBE[]>([]);
  message = signal('');

  showFormBroyage = signal(false);
  showFormDosage = signal(false);
  selectedAffectation = signal<AffectationBE | null>(null);

  totalBroyeAujourd_hui = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.broyage()
      .filter(r => r.date === today)
      .reduce((s, r) => s + (r.quantiteNetteBroyeeKg ?? 0), 0);
  });

  totalFuts = computed(() => {
    const today = new Date().toDateString();
    return this.dosage()
      .filter(r => new Date(r.date).toDateString() === today)
      .reduce((s, r) => s + r.nbFutsProduits, 0);
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
    this.prodSvc.getAffectations({
      debut: new Date().toISOString().split('T')[0],
      fin: new Date().toISOString().split('T')[0]
    }).subscribe({
      next: a => this.affectations.set(a),
      error: () => {},
    });
  }

  validerAffectation(id: number): void {
    this.prodSvc.validerAffectation(id).subscribe({
      next: a => {
        this.affectations.update(list => list.map(x => x.id === a.id ? a : x));
        this.message.set('Affectation validée');
      },
      error: () => this.message.set('Erreur lors de la validation')
    });
  }

  ouvrirDetail(a: AffectationBE): void {
    this.selectedAffectation.set(a);
  }
}
