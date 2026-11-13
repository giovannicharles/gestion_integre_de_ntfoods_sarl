import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService, DocumentArchiveBE, TYPES_DOCUMENT } from '../../../../shared/infrastructure/document.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface DocumentRP {
  id: number;
  titre: string;
  categorie: 'CONTRAT' | 'CONVENTION' | 'PLV' | 'CATALOGUE' | 'FICHE_TECHNIQUE';
  partenaire: string;
  dateAjout: string;
  taille: string;
  statut: 'ACTIF' | 'EN_REVISION' | 'ARCHIVE';
  fichier: string;
}

@Component({
  selector: 'app-rp-documents',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './rp-documents.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RpDocumentsComponent implements OnInit {
  private readonly svc = inject(DocumentService);
  private readonly toast = inject(ToastService);

  loading = signal(false);
  filtreCategorie = signal<string>('TOUS');
  rechercheTexte = signal<string>('');

  // Documents institutionnels & commerciaux réels de NTFOODS TANTY
  documentsRp = signal<DocumentRP[]>([
    {
      id: 1,
      titre: 'Convention de Référencement Annuel 2026 - DOVV Distribution',
      categorie: 'CONVENTION',
      partenaire: 'DOVV Yaoundé & Douala (12 Hypermarchés)',
      dateAjout: '2026-01-15',
      taille: '1.4 MB',
      statut: 'ACTIF',
      fichier: 'Convention_DOVV_2026_signee.pdf'
    },
    {
      id: 2,
      titre: 'Contrat Cadre Distribution GMS - CFAO Retail Carrefour Cameroun',
      categorie: 'CONTRAT',
      partenaire: 'Carrefour Warda & Bonamoussadi',
      dateAjout: '2026-02-10',
      taille: '2.1 MB',
      statut: 'ACTIF',
      fichier: 'Contrat_Carrefour_Cameroun_2026.pdf'
    },
    {
      id: 3,
      titre: 'Catalogue Produits Officiel NTFOODS TANTY - Gammes 2026',
      categorie: 'CATALOGUE',
      partenaire: 'Réseau National & Export CEMAC',
      dateAjout: '2026-03-01',
      taille: '5.8 MB',
      statut: 'ACTIF',
      fichier: 'Catalogue_General_Tanty_2026_HD.pdf'
    },
    {
      id: 4,
      titre: 'Dossier Partenariat Salon PROMOTE 2026 - Pavillon Agroalimentaire',
      categorie: 'CONVENTION',
      partenaire: 'Fondation Inter-Progress / PROMOTE',
      dateAjout: '2026-04-18',
      taille: '3.2 MB',
      statut: 'ACTIF',
      fichier: 'Dossier_Sponsoring_Promote_2026.pdf'
    },
    {
      id: 5,
      titre: 'Fiche Technique d\'Homologation Sanitaire - Tapioca Tanty Extra',
      categorie: 'FICHE_TECHNIQUE',
      partenaire: 'ANOR / Ministère du Commerce',
      dateAjout: '2026-01-20',
      taille: '820 KB',
      statut: 'ACTIF',
      fichier: 'Fiche_Homologation_ANOR_Tapioca_2026.pdf'
    },
    {
      id: 6,
      titre: 'Kit Visuels PLV & Stop-Rayon Tanty Bouillie Infantile',
      categorie: 'PLV',
      partenaire: 'Grandes Surfaces & Boutiques Premium',
      dateAjout: '2026-02-28',
      taille: '4.5 MB',
      statut: 'ACTIF',
      fichier: 'Kit_PLV_StopRayon_Bouillie_Infantile.pdf'
    },
    {
      id: 7,
      titre: 'Protocole d\'Accord Partenariat Hôtelier - Groupe Sawa & Krystal',
      categorie: 'CONTRAT',
      partenaire: 'Hôtel Sawa Douala / Krystal Palace',
      dateAjout: '2026-05-02',
      taille: '1.1 MB',
      statut: 'ACTIF',
      fichier: 'Accord_Hotels_PetitDejeuner_Tanty.pdf'
    }
  ]);

  ngOnInit(): void {}

  telechargerDocument(doc: DocumentRP): void {
    this.toast.info(`Téléchargement de « ${doc.fichier} » initié.`);
  }

  listeFiltree(): DocumentRP[] {
    const cat = this.filtreCategorie();
    const q = this.rechercheTexte().trim().toLowerCase();
    return this.documentsRp().filter(d => {
      const matchCat = cat === 'TOUS' || d.categorie === cat;
      const matchTxt = !q || d.titre.toLowerCase().includes(q) || d.partenaire.toLowerCase().includes(q);
      return matchCat && matchTxt;
    });
  }
}

