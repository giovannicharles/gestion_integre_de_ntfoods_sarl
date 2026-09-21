import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, PreCommandeBE } from '../../../../../domains/commercial/infrastructure/commercial.service';

interface CommandeUI {
  id: string; commercialId: string; dateCommande: Date; statut: string;
  lignes: { produitCode: string; quantite: number }[];
  signatureSecretaire: boolean; signatureComptable: boolean;
}

@Component({
  selector: 'app-secretaire-commandes',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './secretaire-commandes.component.html',
  styleUrls: ['./secretaire-commandes.component.css']
})
export class SecretaireCommandesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);

  today = new Date();
  loading = signal(false);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  commandes = signal<CommandeUI[]>([]);

  commandesSoumises = computed(() => this.commandes().filter(c => c.statut === 'SOUMISE'));
  nbValidees = computed(() => this.commandes().filter(c => c.statut !== 'SOUMISE').length);

  ngOnInit(): void {
    this.loading.set(true);
    this.svc.getPrecommandesAValider().subscribe({
      next: page => { this.commandes.set(page.contenu.map(this.mapPC)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  valider(id: string): void {
    const matricule = this.auth.user()?.matricule ?? '';
    this.svc.validerSecretaire(id, matricule).subscribe({
      next: pc => {
        this.commandes.update(list =>
          list.map(c => c.id === id ? { ...c, statut: 'VALIDEE_SECRETAIRE', signatureSecretaire: true } : c)
        );
      },
    });
  }

  getCommercialNom(id: string): string { return id; }

  getProduitDesignation(code: string): string { return code; }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      SOUMISE: 'badge bg-orange',
      VALIDEE_SECRETAIRE: 'badge bg-success',
      VALIDEE_COMPTABLE: 'badge bg-success',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  private mapPC(pc: PreCommandeBE): CommandeUI {
    return {
      id: pc.numeroPreCommande,
      commercialId: pc.matriculeCommercial,
      dateCommande: new Date(pc.dateSoumission),
      statut: pc.statut,
      lignes: pc.lignes.map(l => ({ produitCode: l.codeProduit, quantite: l.quantiteDemandee })),
      signatureSecretaire: !!pc.matriculeValidateurSecretaire,
      signatureComptable: !!pc.matriculeValidateurComptable,
    };
  }
}
