import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComptableService, ObjectifCommercialBE } from '../../../../comptable/infrastructure/comptable.service';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-dg-objectifs',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './dg-objectifs.component.html',
  styleUrls: ['./dg-objectifs.component.css']
})
export class DgObjectifsComponent implements OnInit {
  today = new Date();
  private readonly cptSvc = inject(ComptableService);
  objectifs = signal<ObjectifCommercialBE[]>([]);
  editMode = signal(false);
  saved = signal(false);

  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;
  Math = Math;

  nbEligibles = computed(() => this.objectifs().filter(o => o.objectifGlobal > 0).length);

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

  cappedTaux(ca: number, obj: number): number { return Math.min(tauxAtteinte(ca, obj), 100); }

  toggleEdit() { this.editMode.update(v => !v); this.saved.set(false); }

  saveObjectifs() {
    this.editMode.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 3000);
  }

  totalObjectif() { return this.objectifs().reduce((s, o) => s + o.objectifGlobal, 0); }
  totalCA() { return this.objectifs().reduce((s, o) => s + o.objectifFarines, 0); }
}
