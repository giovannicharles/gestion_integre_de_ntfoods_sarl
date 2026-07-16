import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DgService, ClassementCommercialBE } from '../../../infrastructure/dg.service';
import { fCFA, tauxAtteinte, getPrimeEligible } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-dg-classement',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule],
  templateUrl: './dg-classement.component.html',
  styleUrls: ['./dg-classement.component.css']
})
export class DgClassementComponent implements OnInit {
  today = new Date();
  selectedSemaine = signal('S26-2026');
  montantPrime = 12000;
  private readonly dgSvc = inject(DgService);

  commerciaux = signal<ClassementCommercialBE[]>([]);
  primesTotal = computed(() => this.commerciaux().filter(c => this.isEligible(c)).length * this.montantPrime);
  nbEligibles = computed(() => this.commerciaux().filter(c => this.isEligible(c)).length);
  totalCaEquipe = computed(() => this.commerciaux().reduce((s, c) => s + c.caRealise, 0));
  totalObjectifEquipe = computed(() => this.commerciaux().length);

  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;
  getPrimeEligible = getPrimeEligible;

  semaines = ['S23-2026', 'S24-2026', 'S25-2026', 'S26-2026'];

  ngOnInit(): void {
    this.dgSvc.getClassement().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => {},
    });
  }

  cappedTaux(ca: number, obj: number): number { return Math.min(tauxAtteinte(ca, obj), 100); }

  tauxRealisation(c: ClassementCommercialBE): number {
    const max = Math.max(...this.commerciaux().map(x => x.caRealise), 1);
    return Math.round((c.caRealise / max) * 100);
  }

  isEligible(c: ClassementCommercialBE): boolean {
    return this.tauxRealisation(c) >= 100;
  }
}
