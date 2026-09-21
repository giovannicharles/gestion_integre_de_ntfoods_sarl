import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComptableService, DecaissementBE } from '../../../../comptable/infrastructure/comptable.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-secretaire-validation',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './secretaire-validation.component.html',
  styleUrls: ['./secretaire-validation.component.css']
})
export class SecretaireValidationComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  private readonly cptSvc = inject(ComptableService);

  decaissements = signal<DecaissementBE[]>([]);

  decaissementsEnAttente = computed(() =>
    this.decaissements().filter(d => d.statut === 'EN_ATTENTE_DG')
  );

  totalEnAttente = computed(() =>
    this.decaissementsEnAttente().length
  );

  ngOnInit(): void {
    this.cptSvc.getDecaissements().subscribe({
      next: d => this.decaissements.set(d),
      error: () => {},
    });
  }

  statutDecClass(s: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE_DG: 'badge bg-orange',
      DG_APPROUVE: 'badge bg-neutral',
      VALIDE: 'badge bg-success',
    };
    return map[s] ?? 'badge bg-neutral';
  }
}
