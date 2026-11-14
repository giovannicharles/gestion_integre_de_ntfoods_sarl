import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DocumentService, DocumentArchiveBE, TYPES_DOCUMENT } from '../../../../shared/infrastructure/document.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-dg-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink],
  templateUrl: './dg-documents.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DgDocumentsComponent implements OnInit {
  private readonly docSvc = inject(DocumentService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  documents = signal<DocumentArchiveBE[]>([]);
  typeFiltre = signal<string>('TOUS');
  termeRecherche = signal<string>('');
  modeAffichage = signal<'table' | 'cartes'>('table');

  // Modal d'import réel
  showModalImport = signal(false);
  importType = signal('RAPPORT');
  importReference = signal('');
  fichierSelectionne: File | null = null;
  importEnCours = signal(false);

  readonly typesDisponibles = TYPES_DOCUMENT;

  ngOnInit(): void {
    this.chargerDocuments();
  }

  chargerDocuments(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.docSvc.rechercher().subscribe({
      next: (docs) => {
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(extractApiError(err));
        this.loading.set(false);
      }
    });
  }

  get documentsFiltres(): DocumentArchiveBE[] {
    const q = this.termeRecherche().toLowerCase().trim();
    const type = this.typeFiltre();
    return this.documents().filter(d => {
      const matchType = type === 'TOUS' || d.typeDocument === type;
      const matchQ = !q ||
        d.reference.toLowerCase().includes(q) ||
        d.nomFichierOriginal.toLowerCase().includes(q) ||
        d.matriculeUploader.toLowerCase().includes(q);
      return matchType && matchQ;
    });
  }

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.fichierSelectionne = input.files[0];
    }
  }

  importerDocument(): void {
    if (!this.fichierSelectionne || !this.importReference().trim()) {
      this.toast.error('Veuillez renseigner une référence et choisir un fichier.');
      return;
    }
    this.importEnCours.set(true);
    this.docSvc.importer(this.importType(), this.importReference().trim(), this.fichierSelectionne).subscribe({
      next: (doc) => {
        this.toast.success(`Document ${doc.nomFichierOriginal} archivé avec succès.`);
        this.showModalImport.set(false);
        this.fichierSelectionne = null;
        this.importReference.set('');
        this.importEnCours.set(false);
        this.chargerDocuments();
      },
      error: (err) => {
        this.toast.error(extractApiError(err) || "Échec de l'archivage du document.");
        this.importEnCours.set(false);
      }
    });
  }

  telecharger(doc: DocumentArchiveBE): void {
    this.docSvc.telecharger(doc.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.nomFichierOriginal || `document-${doc.id}`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => this.toast.error(extractApiError(err) || 'Impossible de télécharger le document.')
    });
  }
}
