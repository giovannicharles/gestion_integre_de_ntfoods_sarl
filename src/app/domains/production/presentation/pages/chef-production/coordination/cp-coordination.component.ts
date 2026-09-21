import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ProductionService, AffectationBE, SessionBroyageBE, SessionDosageBE
} from '../../../../infrastructure/production.service';

type Onglet = 'salle' | 'machiniste' | 'doseur';

/**
 * COORDINATION DES ACTEURS — Chef de Production
 * Supervision de l'activité du jour de chaque rôle opérationnel :
 * Responsable Salle (affectations), Chef Machiniste (broyage), Agent Doseur
 * (dosage). Tous les appels utilisés ici sont explicitement autorisés pour
 * CHEF_PRODUCTION dans les @PreAuthorize backend.
 */
@Component({
  selector: 'app-cp-coordination',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './cp-coordination.component.html',
  styleUrls: ['./cp-coordination.component.css', '../_shared.css']
})
export class CpCoordinationComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  onglet = signal<Onglet>('salle');
  loading = signal(true);

  affectations = signal<AffectationBE[]>([]);
  sessionsBroyage = signal<SessionBroyageBE[]>([]);
  sessionsDosage = signal<SessionDosageBE[]>([]);

  today = new Date().toISOString().split('T')[0];

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getAffectations({ debut: this.today, fin: this.today }).subscribe({ next: a => this.affectations.set(a) });
    this.svc.getSessionsBroyage({ debut: this.today, fin: this.today }).subscribe({ next: s => this.sessionsBroyage.set(s) });
    this.svc.getSessionsDosageParDate(this.today).subscribe({ next: s => { this.sessionsDosage.set(s); this.loading.set(false); } });
  }

  changerOnglet(o: Onglet): void { this.onglet.set(o); }

  saisiePourPoste(a: AffectationBE, codePoste: string): number | null {
    return a.saisies.find(s => s.codePoste === codePoste)?.quantiteRealisee ?? null;
  }
}
