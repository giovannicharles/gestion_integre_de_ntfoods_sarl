import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PPHRepartitionJourBE } from '../../../infrastructure/production.service';
import { libelleEmballage, nomsMatieres, qteEmballage, qteMatiere, totalKg, typesEmballage } from '../../../infrastructure/production-besoins.util';

/**
 * Tableau des besoins par jour d'un plan de production : une colonne par
 * matière première et par composant d'emballage réellement présents dans le
 * plan (issus des formules et compositions d'emballage des produits), au lieu
 * des colonnes maïs/soja/arachide et sachet/couvercle/scellé figées d'avant.
 */
@Component({
  selector: 'app-besoins-par-jour',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tbl-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Jour</th>
            @for (m of matieres(); track m) { <th>{{ m }} (kg)</th> }
            @if (showTotal() && matieres().length > 1) { <th>Total (kg)</th> }
            @if (showFuts()) { <th>Fûts 50 kg</th> }
            @if (showEmballage()) {
              @for (t of emballages(); track t) { <th>{{ libelle(t) }}</th> }
            }
          </tr>
        </thead>
        <tbody>
          @for (r of repartition(); track r.dateJour) {
            <tr>
              <td><strong>{{ r.dateJour | date:'EEE dd/MM/yyyy' }}</strong></td>
              @for (m of matieres(); track m) { <td>{{ qteMatiere(r.besoinsMatieresPremiere, m) | number:'1.1-2' }}</td> }
              @if (showTotal() && matieres().length > 1) { <td>{{ totalKg(r.besoinsMatieresPremiere) | number:'1.1-2' }}</td> }
              @if (showFuts()) { <td>{{ r.futsPrevus | number:'1.0-2' }}</td> }
              @if (showEmballage()) {
                @for (t of emballages(); track t) { <td>{{ qteEmballage(r.besoinsEmballage, t) }}</td> }
              }
            </tr>
          } @empty {
            <tr><td [attr.colspan]="colonnes()" class="text-center text-muted">Aucune répartition journalière</td></tr>
          }
        </tbody>
      </table>
    </div>
    @if (repartition().length > 0 && matieres().length === 0) {
      <p class="text-muted" style="margin:8px 0 0;font-size:12px">
        Aucun besoin en matière première calculé : les produits de ce plan n'ont pas de formule de production.
      </p>
    }
  `,
})
export class BesoinsParJourComponent {
  readonly repartition = input.required<PPHRepartitionJourBE[]>();
  readonly showFuts = input(true);
  readonly showEmballage = input(true);
  readonly showTotal = input(true);

  readonly matieres = computed(() => nomsMatieres(this.repartition().map(r => r.besoinsMatieresPremiere)));
  readonly emballages = computed(() => typesEmballage(this.repartition().map(r => r.besoinsEmballage)));
  readonly colonnes = computed(() =>
    1 + this.matieres().length + (this.showTotal() && this.matieres().length > 1 ? 1 : 0)
    + (this.showFuts() ? 1 : 0) + (this.showEmballage() ? this.emballages().length : 0));

  readonly qteMatiere = qteMatiere;
  readonly qteEmballage = qteEmballage;
  readonly totalKg = totalKg;
  readonly libelle = libelleEmballage;
}
