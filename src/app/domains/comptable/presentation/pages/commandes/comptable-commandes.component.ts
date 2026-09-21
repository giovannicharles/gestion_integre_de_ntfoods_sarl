import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, PreCommandeBE } from '../../../../commercial/infrastructure/commercial.service';

interface LigneUI {
  produitCode: string;
  designation: string;
  quantite: number;
  quantiteValidee: number;
}

interface CommandeUI {
  id: string;
  commercialId: string;
  commercialName?: string;
  dateCommande: Date;
  statut: string;
  lignes: LigneUI[];
  signatureSecretaire: boolean;
  signatureComptable: boolean;
}

@Component({
  selector: 'app-comptable-commandes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './comptable-commandes.component.html',
  styleUrls: ['./comptable-commandes.component.css']
})
export class ComptableCommandesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);

  commandes = signal<CommandeUI[]>([]);
  filtreStatut = signal<string>('VALIDEE_SECRETAIRE');
  statutOptions = ['TOUTES', 'SOUMISE', 'VALIDEE_SECRETAIRE', 'VALIDEE_COMPTABLE'];

  commandesFiltrees = computed(() => {
    const f = this.filtreStatut();
    return f === 'TOUTES' ? this.commandes() : this.commandes().filter(c => c.statut === f);
  });

  nbEnAttente = computed(() => this.commandes().filter(c => c.statut === 'VALIDEE_SECRETAIRE').length);
  nbValidees = computed(() => this.commandes().filter(c => c.statut === 'VALIDEE_COMPTABLE').length);

  ngOnInit(): void {
    this.loading.set(true);
    this.svc.getPrecommandesAValiderComptable().subscribe({
      next: page => { this.commandes.set(page.contenu.map(this.mapPC)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  trackByLigne(index: number, ligne: LigneUI): string {
    return ligne.produitCode;
  }

  validerCommande(id: string): void {
    const matricule = this.auth.user()?.matricule ?? '';
    const cmd = this.commandes().find(c => c.id === id);
    if (!cmd) return;

    const quantitesValidees: Record<string, number> = {};
    for (const l of cmd.lignes) {
      quantitesValidees[l.produitCode] = l.quantiteValidee;
    }

    this.svc.validerComptable(id, matricule, quantitesValidees).subscribe({
      next: () => {
        this.commandes.update(list =>
          list.map(c => c.id === id
            ? { ...c, statut: 'VALIDEE_COMPTABLE', signatureComptable: true }
            : c
          )
        );
      },
    });
  }

  getCommercialNom(id: string): string { return id; }
  getProduitDesignation(code: string): string { return code; }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      SOUMISE: 'Soumise',
      VALIDEE_SECRETAIRE: 'Validée Secrétaire',
      VALIDEE_COMPTABLE: 'Validée Comptable',
    };
    return map[s] ?? s;
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      SOUMISE: 'badge bg-orange',
      VALIDEE_SECRETAIRE: 'badge bg-neutral',
      VALIDEE_COMPTABLE: 'badge bg-success',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  private mapPC(pc: PreCommandeBE): CommandeUI {
    return {
      id: pc.numeroPreCommande,
      commercialId: pc.matriculeCommercial,
      commercialName: pc.nomCommercial,
      dateCommande: new Date(pc.dateSoumission),
      statut: pc.statut,
      lignes: pc.lignes.map(l => ({
        produitCode: l.codeProduit,
        designation: l.designationProduit,
        quantite: l.quantiteDemandee,
        quantiteValidee: l.quantiteValidee ?? l.quantiteDemandee,
      })),
      signatureSecretaire: !!pc.matriculeValidateurSecretaire,
      signatureComptable: !!pc.matriculeValidateurComptable,
    };
  }
}
