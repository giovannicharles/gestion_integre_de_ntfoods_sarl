import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../infrastructure/admin.service';

@Component({
  selector: 'app-admin-parametres',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule],
  templateUrl: './admin-parametres.component.html',
  styleUrls: ['./admin-parametres.component.css']
})
export class AdminParametresComponent implements OnInit {
  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  private readonly svc = inject(AdminService);

  form = {
    tvaTaux: 0,
    primeMontant: 0,
    alerteStockSeuil: 0,
    seuilClientStrategique: 500000,
  };

  zones = signal<string[]>([]);
  gammeProduits = signal<string[]>([]);
  villes = signal<string[]>([]);

  submitted = signal(false);
  isDirty = signal(false);
  loading = signal(false);

  newZone = signal('');
  newGamme = signal('');
  newVille = signal('');

  ngOnInit(): void {
    this.loading.set(true);
    this.svc.getParametres().subscribe({
      next: (p) => {
        this.form.tvaTaux = p.tvaTaux;
        this.form.primeMontant = p.primeMontant;
        this.form.alerteStockSeuil = p.alerteStockSeuil;
        this.form.seuilClientStrategique = p.seuilClientStrategique ?? 500000;
        this.zones.set([...p.zones]);
        this.gammeProduits.set([...p.gammeProduits]);
        this.villes.set([...p.villes]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * Sauvegarde le taux de TVA.
   *
   * Le montant de prime et le seuil de stock sont retransmis inchangés : l'API
   * historique attend les trois valeurs ensemble, mais elles ne gouvernent plus
   * aucun calcul — les agrégats de configuration datés font désormais autorité.
   */
  sauvegarder(): void {
    this.svc.modifierParametres(
      this.form.tvaTaux, this.form.primeMontant, this.form.alerteStockSeuil, this.form.seuilClientStrategique
    ).subscribe({
      next: () => {
        this.submitted.set(true);
        this.isDirty.set(false);
        setTimeout(() => this.submitted.set(false), 3000);
      },
    });
  }

  onFieldChange(): void {
    this.isDirty.set(true);
  }

  addZone(): void {
    const z = this.newZone().trim();
    if (!z) return;
    this.svc.ajouterReferentiel('ZONE', z).subscribe({
      next: (p) => { this.zones.set([...p.zones]); this.newZone.set(''); },
    });
  }

  removeZone(z: string): void {
    this.svc.supprimerReferentiel('ZONE', z).subscribe({
      next: (p) => this.zones.set([...p.zones]),
    });
  }

  addGamme(): void {
    const g = this.newGamme().trim();
    if (!g) return;
    this.svc.ajouterReferentiel('GAMME', g).subscribe({
      next: (p) => { this.gammeProduits.set([...p.gammeProduits]); this.newGamme.set(''); },
    });
  }

  removeGamme(g: string): void {
    this.svc.supprimerReferentiel('GAMME', g).subscribe({
      next: (p) => this.gammeProduits.set([...p.gammeProduits]),
    });
  }

  addVille(): void {
    const v = this.newVille().trim();
    if (!v) return;
    this.svc.ajouterReferentiel('VILLE', v).subscribe({
      next: (p) => { this.villes.set([...p.villes]); this.newVille.set(''); },
    });
  }

  removeVille(v: string): void {
    this.svc.supprimerReferentiel('VILLE', v).subscribe({
      next: (p) => this.villes.set([...p.villes]),
    });
  }
}
