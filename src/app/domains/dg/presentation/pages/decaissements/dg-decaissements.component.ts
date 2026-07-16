import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ComptableService, DecaissementBE } from '../../../../comptable/infrastructure/comptable.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-dg-decaissements',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './dg-decaissements.component.html',
  styleUrls: ['./dg-decaissements.component.css']
})
export class DgDecaissementsComponent implements OnInit {
  today = new Date();
  private readonly cptSvc = inject(ComptableService);
  decaissements = signal<DecaissementBE[]>([]);
  filterStatut = signal<'all' | 'EN_ATTENTE_DG' | 'DG_APPROUVE' | 'VALIDE'>('all');

  liste = computed(() => {
    const f = this.filterStatut();
    return f === 'all' ? this.decaissements() : this.decaissements().filter(d => d.statut === f);
  });

  nbEnAttentesDG = computed(() => this.decaissements().filter(d => d.statut === 'EN_ATTENTE_DG').length);
  totalEnAttente = computed(() => this.decaissements().filter(d => d.statut === 'EN_ATTENTE_DG' || d.statut === 'DG_APPROUVE').reduce((s, d) => s + d.montantFCFA, 0));
  nbValides = computed(() => this.decaissements().filter(d => d.statut === 'VALIDE').length);
  totalValide = computed(() => this.decaissements().filter(d => d.statut === 'VALIDE').reduce((s, d) => s + d.montantFCFA, 0));
  totalDecaissements = computed(() => this.decaissements().reduce((s, d) => s + d.montantFCFA, 0));

  fCFA = fCFA;

  ngOnInit(): void {
    this.cptSvc.getDecaissements().subscribe({
      next: d => this.decaissements.set(d),
      error: () => {},
    });
  }

  approuverDG(numero: string) {
    this.cptSvc.approuverDecaissementDG(numero, '').subscribe({
      next: updated => this.decaissements.update(list => list.map(d => d.numero === numero ? updated : d)),
    });
  }
  refuserDG(numero: string) {
    this.cptSvc.annulerDecaissement(numero, 'Refusé par DG', '').subscribe({
      next: updated => this.decaissements.update(list => list.map(d => d.numero === numero ? updated : d)),
    });
  }
}
