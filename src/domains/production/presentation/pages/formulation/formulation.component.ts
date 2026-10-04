import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormulationService, Formulation, LigneFormulation, BesoinProduction, CapaciteProduction } from '../../../../../core/services/formulation.service';

@Component({
  selector: 'app-formulation',
  templateUrl: './formulation.component.html',
  styleUrls: ['./formulation.component.css']
})
export class FormulationComponent implements OnInit {
  formulationForm: FormGroup;
  ligneForm: FormGroup;
  formulations: Formulation[] = [];
  lignes: LigneFormulation[] = [];
  besoinsMP: BesoinProduction[] = [];
  capaciteProduction: CapaciteProduction | null = null;

  constructor(
    private fb: FormBuilder,
    private formulationService: FormulationService
  ) {
    this.formulationForm = this.fb.group({
      codeFormulation: ['', Validators.required],
      codeProduit: ['', Validators.required],
      sku: [''],
      designation: [''],
      codeConditionnement: [''],
      niveauConditionnement: ['', Validators.required],
      quantiteUnite: [0, [Validators.required, Validators.min(0.01)]],
      unite: ['KG', Validators.required],
      version: ['v1.0', Validators.required],
      creePar: ['', Validators.required]
    });

    this.ligneForm = this.fb.group({
      codeMP: ['', Validators.required],
      nomMP: ['', Validators.required],
      quantiteUnite: [0, [Validators.required, Validators.min(0.01)]],
      unite: ['KG', Validators.required],
      pertePct: [0, [Validators.min(0), Validators.max(100)]],
      raisonPerte: ['']
    });
  }

  ngOnInit(): void {}

  ajouterLigne(): void {
    if (this.ligneForm.valid) {
      const ligne: LigneFormulation = this.ligneForm.value;
      this.lignes.push(ligne);
      this.ligneForm.reset({
        unite: 'KG',
        pertePct: 0
      });
    }
  }

  supprimerLigne(index: number): void {
    this.lignes.splice(index, 1);
  }

  creerFormulation(): void {
    if (this.formulationForm.valid && this.lignes.length > 0) {
      const formulation: Omit<Formulation, 'id'> = {
        ...this.formulationForm.value,
        lignes: this.lignes,
        statut: 'BROUILLON',
        dateDebutValidite: new Date().toISOString().split('T')[0]
      };

      this.formulationService.creer(formulation).subscribe({
        next: (result) => {
          console.log('Formulation créée:', result);
          this.formulations.push(result);
          this.resetForm();
        },
        error: (err) => console.error('Erreur création formulation:', err)
      });
    }
  }

  validerFormulation(codeFormulation: string): void {
    this.formulationService.valider(codeFormulation, 'USER-001').subscribe({
      next: (result) => {
        console.log('Formulation validée:', result);
        const index = this.formulations.findIndex(f => f.codeFormulation === codeFormulation);
        if (index !== -1) {
          this.formulations[index] = result;
        }
      },
      error: (err) => console.error('Erreur validation formulation:', err)
    });
  }

  calculerBesoin(): void {
    const codeFormulation = this.formulationForm.get('codeFormulation')?.value;
    const nombreUnites = 100; // Exemple: 100 unités
    const niveauConditionnement = this.formulationForm.get('niveauConditionnement')?.value;

    if (codeFormulation && nombreUnites > 0 && niveauConditionnement) {
      this.formulationService.calculerBesoin(codeFormulation, nombreUnites, niveauConditionnement).subscribe({
        next: (result) => {
          this.besoinsMP = result;
          console.log('Besoins MP calculés:', result);
        },
        error: (err) => console.error('Erreur calcul besoin:', err)
      });
    }
  }

  predireProduction(): void {
    const codeFormulation = this.formulationForm.get('codeFormulation')?.value;
    const niveauConditionnement = this.formulationForm.get('niveauConditionnement')?.value;

    if (codeFormulation && niveauConditionnement) {
      this.formulationService.predireProduction(codeFormulation, niveauConditionnement).subscribe({
        next: (result) => {
          this.capaciteProduction = result;
          console.log('Capacité production prédite:', result);
        },
        error: (err) => console.error('Erreur prédiction production:', err)
      });
    }
  }

  resetForm(): void {
    this.formulationForm.reset({
      unite: 'KG',
      version: 'v1.0'
    });
    this.lignes = [];
    this.besoinsMP = [];
    this.capaciteProduction = null;
  }
}
