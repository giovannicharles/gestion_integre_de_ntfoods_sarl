import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ProductionService, ClassementExecuteurBE } from '../../../../infrastructure/production.service';

/**
 * CLASSEMENT DES EMPLOYÉS — Responsable de Salle
 * Hebdomadaire et mensuel, selon quantité produite / productivité / taux
 * d'atteinte — GET /affectations/classement-executeurs (réel).
 */
@Component({
  selector: 'app-rs-classement-employes',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './rs-classement-employes.component.html',
  styleUrls: ['./rs-classement-employes.component.css', '../_shared.css']
})
export class RsClassementEmployesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  classementHebdo = signal<ClassementExecuteurBE[]>([]);
  classementMensuel = signal<ClassementExecuteurBE[]>([]);

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    const fin = new Date().toISOString().split('T')[0];
    this.svc.getClassementExecuteurs(this.debutSemaine(), fin).subscribe({ next: c => this.classementHebdo.set(c) });
    this.svc.getClassementExecuteurs(this.debutMois(), fin).subscribe({ next: c => { this.classementMensuel.set(c); this.loading.set(false); } });
  }

  private debutSemaine(): string { const d = new Date(); const j = d.getDay(); return new Date(d.setDate(d.getDate() - j + (j === 0 ? -6 : 1))).toISOString().split('T')[0]; }
  private debutMois(): string { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; }

  medaille(rang: number): string {
    if (rang === 1) return '🥇'; if (rang === 2) return '🥈'; if (rang === 3) return '🥉'; return '';
  }
}
