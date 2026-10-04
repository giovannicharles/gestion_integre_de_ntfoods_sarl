import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSystemeService, ParametreSystemeBE, CreerParametreSystemeRequest } from '../../../infrastructure/admin-systeme.service';

@Component({
  selector: 'app-admin-systeme-parametres',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-systeme-parametres.component.html',
  styleUrls: ['./admin-systeme-parametres.component.css']
})
export class AdminSystemeParametresComponent implements OnInit {
  private readonly svc = inject(AdminSystemeService);

  parametres = signal<ParametreSystemeBE[]>([]);
  loading = signal(false);
  erreur = signal<string | null>(null);
  succes = signal<string | null>(null);

  editValeurs: Record<string, string> = {};

  formCreation: CreerParametreSystemeRequest = this.formVide();
  afficherFormCreation = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(null);
    this.svc.lister().subscribe({
      next: (liste) => {
        this.parametres.set(liste);
        liste.forEach(p => this.editValeurs[p.code] = p.valeur);
        this.loading.set(false);
      },
      error: () => {
        this.erreur.set('Impossible de charger les paramètres système.');
        this.loading.set(false);
      }
    });
  }

  sauvegarderValeur(p: ParametreSystemeBE): void {
    const nouvelleValeur = this.editValeurs[p.code];
    if (nouvelleValeur === p.valeur) return;
    this.svc.modifierValeur(p.code, nouvelleValeur).subscribe({
      next: (maj) => {
        this.parametres.set(this.parametres().map(x => x.code === maj.code ? maj : x));
        this.afficherSucces(`Paramètre ${maj.code} mis à jour.`);
      },
      error: (err) => this.erreur.set(err?.error?.erreur ?? `Échec de la mise à jour de ${p.code}.`)
    });
  }

  reinitialiser(p: ParametreSystemeBE): void {
    this.svc.reinitialiser(p.code).subscribe({
      next: (maj) => {
        this.parametres.set(this.parametres().map(x => x.code === maj.code ? maj : x));
        this.editValeurs[maj.code] = maj.valeur;
        this.afficherSucces(`Paramètre ${maj.code} réinitialisé.`);
      },
      error: (err) => this.erreur.set(err?.error?.erreur ?? `Échec de la réinitialisation de ${p.code}.`)
    });
  }

  desactiver(p: ParametreSystemeBE): void {
    if (!confirm(`Désactiver le paramètre « ${p.code} » ?`)) return;
    this.svc.desactiver(p.code).subscribe({
      next: () => {
        this.parametres.set(this.parametres().filter(x => x.code !== p.code));
        this.afficherSucces(`Paramètre ${p.code} désactivé.`);
      },
      error: (err) => this.erreur.set(err?.error?.erreur ?? `Échec de la désactivation de ${p.code}.`)
    });
  }

  creer(): void {
    this.erreur.set(null);
    this.svc.creer(this.formCreation).subscribe({
      next: (nouveau) => {
        this.parametres.set([...this.parametres(), nouveau]);
        this.editValeurs[nouveau.code] = nouveau.valeur;
        this.formCreation = this.formVide();
        this.afficherFormCreation.set(false);
        this.afficherSucces(`Paramètre ${nouveau.code} créé.`);
      },
      error: (err) => this.erreur.set(err?.error?.erreur ?? 'Échec de la création du paramètre.')
    });
  }

  private afficherSucces(msg: string): void {
    this.succes.set(msg);
    setTimeout(() => this.succes.set(null), 3000);
  }

  private formVide(): CreerParametreSystemeRequest {
    return { code: '', nom: '', valeur: '', typeValeur: 'STRING' };
  }
}
