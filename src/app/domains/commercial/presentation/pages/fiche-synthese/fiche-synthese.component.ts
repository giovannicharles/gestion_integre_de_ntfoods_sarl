import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CommercialService, FicheSyntheseBE, LigneFicheSyntheseBE } from '../../../infrastructure/commercial.service';

@Component({
  selector: 'app-fiche-synthese',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './fiche-synthese.component.html',
  styleUrls: ['./fiche-synthese.component.css']
})
export class FicheSyntheseComponent implements OnInit {
  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  private readonly svc = inject(CommercialService);

  fiche = signal<FicheSyntheseBE | null>(null);
  produits = signal<{ code: string; designation: string; unite: string; gamme: string; prixHT: number }[]>([]);

  ngOnInit(): void {
    this.svc.getFicheSynthese().subscribe({
      next: f => this.fiche.set(f),
      error: () => {},
    });
  }

  getProduit(code: string) {
    return this.produits().find(p => p.code === code) || { code, designation: code, unite: 'u', gamme: '', prixHT: 0 };
  }
}
