import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, ClassementMachinisteBE } from '../../../../infrastructure/production.service';

type Critere = 'productivite' | 'efficacite' | 'taux';

/**
 * CLASSEMENTS — Chef Machiniste
 * Classement hebdomadaire et mensuel, selon productivité / efficacité / taux
 * de réalisation. Top machinistes avec médaille, badge, pourcentage, progression.
 */
@Component({
  selector: 'app-cm-classements',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './cm-classements.component.html',
  styleUrls: ['./cm-classements.component.css', '../_shared.css']
})
export class CmClassementsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  error = signal('');

  classementHebdo = signal<ClassementMachinisteBE | null>(null);
  classementMensuel = signal<ClassementMachinisteBE | null>(null);
  critere = signal<Critere>('productivite');

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    const aujourdHui = new Date().toISOString().split('T')[0];
    this.svc.getClassementMachinistes(this.debutSemaine(), aujourdHui).subscribe({
      next: c => this.classementHebdo.set(this.trierSelonCritere(c)),
      error: () => this.error.set('Erreur lors du chargement du classement hebdomadaire')
    });
    this.svc.getClassementMachinistes(this.debutMois(), aujourdHui).subscribe({
      next: c => { this.classementMensuel.set(this.trierSelonCritere(c)); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors du chargement du classement mensuel'); this.loading.set(false); }
    });
  }

  changerCritere(c: Critere): void {
    this.critere.set(c);
    this.classementHebdo.update(x => x ? this.trierSelonCritere(x) : x);
    this.classementMensuel.update(x => x ? this.trierSelonCritere(x) : x);
  }

  private trierSelonCritere(c: ClassementMachinisteBE): ClassementMachinisteBE {
    const key = this.critere() === 'productivite' ? 'productiviteKg' : this.critere() === 'efficacite' ? 'efficacite' : 'tauxRealisationMoyen';
    const tries = [...c.classements].sort((a, b) => (b as any)[key] - (a as any)[key]).map((x, i) => ({ ...x, rang: i + 1 }));
    return { ...c, classements: tries };
  }

  medaille(rang: number): string {
    if (rang === 1) return '🥇';
    if (rang === 2) return '🥈';
    if (rang === 3) return '🥉';
    return '';
  }

  valeurCritere(x: { productiviteKg: number; efficacite: number; tauxRealisationMoyen: number }): number {
    return this.critere() === 'productivite' ? x.productiviteKg : this.critere() === 'efficacite' ? x.efficacite : x.tauxRealisationMoyen;
  }

  private debutSemaine(): string {
    const d = new Date();
    const jour = d.getDay();
    const diff = d.getDate() - jour + (jour === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }
  private debutMois(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }
}
