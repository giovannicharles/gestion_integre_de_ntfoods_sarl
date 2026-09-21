import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, FicheProductionBE } from '../../../../infrastructure/production.service';

/**
 * FICHE INFO PRODUIT JOURNALIÈRE — Responsable de Salle
 *
 * ⚠️ Correction d'un bug du module précédent : `GET /fiches/pph/{ref}` (liste)
 * n'autorise PAS RESPONSABLE_SALLE — seule la consultation d'UNE fiche précise
 * (`GET /fiches/pph/{ref}/date/{date}`) l'est. Cette vue n'utilise donc que
 * cet endpoint, jamais la liste.
 */
@Component({
  selector: 'app-rs-fiche-info-produit',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './rs-fiche-info-produit.component.html',
  styleUrls: ['./rs-fiche-info-produit.component.css', '../_shared.css']
})
export class RsFicheInfoProduitComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  message = signal('');
  pphs = signal<PPHBE[]>([]);
  referencePPH = '';
  date = new Date().toISOString().split('T')[0];
  fiche = signal<FicheProductionBE | null>(null);

  ngOnInit(): void {
    this.svc.getPPHs('EN_COURS').subscribe({
      next: p => { this.pphs.set(p); if (p.length) { this.referencePPH = p[0].referencePPH; this.charger(); } else this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  charger(): void {
    if (!this.referencePPH) return;
    this.loading.set(true);
    this.svc.getFiche(this.referencePPH, this.date).subscribe({
      next: f => { this.fiche.set(f); this.loading.set(false); },
      error: () => { this.fiche.set(null); this.loading.set(false); }
    });
  }

  genererFiche(): void {
    const p = this.pphs().find(x => x.referencePPH === this.referencePPH);
    if (!p) return;
    const lignes = p.lignes.map(l => ({ codeProduit: l.codeProduit, nomProduit: l.nomProduit, quantiteProduite: 0 }));
    this.svc.enregistrerFiche({
      referencePPH: this.referencePPH, semaine: p.semaine, date: this.date,
      matriculeAgentProduction: 'RS', lignes
    }).subscribe({
      next: f => { this.fiche.set(f); this.message.set('Fiche générée'); },
      error: () => this.message.set('Erreur lors de la génération de la fiche')
    });
  }

  modifierQuantite(index: number, valeur: number): void {
    const f = this.fiche();
    if (f) f.lignes[index].quantiteProduite = valeur;
  }

  enregistrerCorrections(): void {
    const f = this.fiche();
    if (!f) return;
    this.svc.modifierFiche(this.referencePPH, this.date, {
      lignes: f.lignes.map(l => ({ codeProduit: l.codeProduit, nomProduit: l.nomProduit, quantiteProduite: l.quantiteProduite }))
    }).subscribe({
      next: updated => { this.fiche.set(updated); this.message.set('Fiche corrigée'); },
      error: () => this.message.set('Erreur — fiche probablement verrouillée')
    });
  }

  imprimer(): void {
    const f = this.fiche();
    if (!f) return;
    const w = window.open('', '_blank');
    if (!w) { this.message.set('Autorisez les pop-ups pour imprimer'); return; }
    const lignes = f.lignes.map(l => `<tr><td>${l.nomProduit}</td><td>${l.quantiteProduite}</td><td>${l.quantitePrediteDosage ?? '—'}</td><td>${l.quantitePreditePostes ?? '—'}</td><td>${l.ecart ?? '—'}</td><td>${l.tauxAvancement ?? '—'}%</td></tr>`).join('');
    w.document.write(`<html><head><title>Fiche Info Produit ${f.referencePPH} ${f.date}</title>
      <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:6px;font-size:12px}</style></head>
      <body><h1>Fiche Info Produit</h1><p>PPH : ${f.referencePPH} — Date : ${f.date}</p>
      <table><thead><tr><th>Produit</th><th>Quantité réelle</th><th>Prédiction dosage</th><th>Prédiction postes</th><th>Écart</th><th>Progression</th></tr></thead><tbody>${lignes}</tbody></table>
      </body></html>`);
    w.document.close(); w.print();
  }
}
