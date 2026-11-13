import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface DocItem {
  id: string;
  titre: string;
  categorie: 'Catalogue' | 'Tarif' | 'Fiche Produit' | 'Argumentaire' | 'Contrat';
  description: string;
  format: 'PDF' | 'XLSX' | 'DOCX';
  taille: string;
  dateMaj: string;
  telechargements: number;
}

@Component({
  selector: 'app-commercial-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './commercial-documents.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialDocumentsComponent {
  termeRecherche = signal('');
  categorieFiltre = signal<string>('TOUS');

  documents = signal<DocItem[]>([
    {
      id: 'DOC-COM-01',
      titre: 'Catalogue Officiel Produits TANTY 2026',
      categorie: 'Catalogue',
      description: 'Catalogue complet avec fiches techniques, grammages, conditionnements et visuels haute définition.',
      format: 'PDF',
      taille: '4.8 Mo',
      dateMaj: '02/01/2026',
      telechargements: 142
    },
    {
      id: 'DOC-COM-02',
      titre: 'Grille Tarifaire Réseau Détaillants & Demi-Gros',
      categorie: 'Tarif',
      description: 'Barème officiel des prix carton, prix unitaire conseillé, marges boutiquiers et remises paliers.',
      format: 'PDF',
      taille: '820 Ko',
      dateMaj: '15/01/2026',
      telechargements: 285
    },
    {
      id: 'DOC-COM-03',
      titre: 'Fiche Argumentaire : Bouillies Composées Soja & Maïs',
      categorie: 'Argumentaire',
      description: 'Arguments nutritionnels, certifications sanitaires et conseils de préparation pour convaincre les mères de famille.',
      format: 'PDF',
      taille: '1.2 Mo',
      dateMaj: '10/01/2026',
      telechargements: 98
    },
    {
      id: 'DOC-COM-04',
      titre: 'Grille Tarifaire Grands Comptes & Réseaux GMS (Dovv, Carrefour)',
      categorie: 'Tarif',
      description: 'Conditions d’approvisionnement centrales d’achat, remises de fin d’année (RFA) et délais de paiement.',
      format: 'PDF',
      taille: '1.1 Mo',
      dateMaj: '05/01/2026',
      telechargements: 64
    },
    {
      id: 'DOC-COM-05',
      titre: 'Modèle Bon de Commande Spécial Événementiel',
      categorie: 'Contrat',
      description: 'Formulaire standard de commande pour cérémonies, cantines scolaires et réceptions d’entreprise.',
      format: 'DOCX',
      taille: '320 Ko',
      dateMaj: '20/01/2026',
      telechargements: 76
    },
    {
      id: 'DOC-COM-06',
      titre: 'Fiche Technique Gamme Amuse-Gueules & Chips Plantain',
      categorie: 'Fiche Produit',
      description: 'Durée de conservation (DLC), conditions de stockage en boutique, variétés salées, sucrées et pimentées.',
      format: 'PDF',
      taille: '950 Ko',
      dateMaj: '12/01/2026',
      telechargements: 110
    }
  ]);

  get docsFiltres(): DocItem[] {
    const q = this.termeRecherche().toLowerCase().trim();
    const cat = this.categorieFiltre();
    return this.documents().filter(d => {
      const matchCat = cat === 'TOUS' || d.categorie === cat;
      const matchQ = !q || d.titre.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }

  telecharger(doc: DocItem): void {
    const contenu = `NT FOODS SARL - TANTY\nDocument Commercial : ${doc.titre}\nRéférence : ${doc.id}\nCatégorie : ${doc.categorie}\nDate : ${doc.dateMaj}\n\nCe document est réservé à l'équipe commerciale et aux partenaires agréés TANTY.`;
    const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.id}_${doc.titre.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
