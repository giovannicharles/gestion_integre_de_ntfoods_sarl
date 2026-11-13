import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService, DocumentArchiveBE, TYPES_DOCUMENT } from '../../../../shared/infrastructure/document.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-comptable-documents',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './comptable-documents.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComptableDocumentsComponent implements OnInit {
  private readonly svc = inject(DocumentService);
  private readonly toast = inject(ToastService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  documents = signal<DocumentArchiveBE[]>([]);
  filtreType = signal<string>('TOUS');
  rechercheTexte = signal<string>('');

  // Modal import
  showModalImport = signal(false);
  importType = signal('FACTURE');
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
    this.svc.rechercher().subscribe({
      next: docs => {
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: err => {
        this.loadError.set(extractApiError(err));
        this.loading.set(false);
      }
    });
  }

  onFichierSelectionne(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.fichierSelectionne = input.files[0];
    }
  }

  ouvrirModalImport(): void {
    this.importType.set('FACTURE');
    this.importReference.set('');
    this.fichierSelectionne = null;
    this.showModalImport.set(true);
  }

  fermerModalImport(): void {
    this.showModalImport.set(false);
  }

  executerImport(): void {
    if (!this.fichierSelectionne) {
      this.toast.error('Veuillez sélectionner un fichier justificatif à téléverser.');
      return;
    }
    const ref = this.importReference().trim() || this.fichierSelectionne.name.replace(/\.[^/.]+$/, '');
    this.importEnCours.set(true);

    this.svc.importer(this.importType(), ref, this.fichierSelectionne).subscribe({
      next: nouveauDoc => {
        this.importEnCours.set(false);
        this.showModalImport.set(false);
        this.toast.success(`Pièce comptable « ${nouveauDoc.nomFichierOriginal} » enregistrée avec succès.`);
        this.documents.update(docs => [nouveauDoc, ...docs]);
      },
      error: err => {
        this.importEnCours.set(false);
        this.toast.error(extractApiError(err));
      }
    });
  }

  telechargerDocument(doc: DocumentArchiveBE): void {
    this.toast.info(`Téléchargement de « ${doc.nomFichierOriginal} » en cours...`);
    this.svc.telecharger(doc.id).subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.nomFichierOriginal || `piece-${doc.id}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toast.success(`Fichier téléchargé.`);
      },
      error: err => {
        this.toast.error(extractApiError(err));
      }
    });
  }

  get listeFiltree(): DocumentArchiveBE[] {
    const type = this.filtreType();
    const q = this.rechercheTexte().trim().toLowerCase();
    return this.documents().filter(d => {
      const matchType = type === 'TOUS' || d.typeDocument === type;
      const matchTxt = !q ||
        d.reference.toLowerCase().includes(q) ||
        d.nomFichierOriginal.toLowerCase().includes(q) ||
        (d.matriculeUploader && d.matriculeUploader.toLowerCase().includes(q));
      return matchType && matchTxt;
    });
  }

  formatTaille(octets: number): string {
    if (!octets || octets === 0) return '0 Ko';
    if (octets < 1024) return octets + ' o';
    if (octets < 1024 * 1024) return (octets / 1024).toFixed(1) + ' Ko';
    return (octets / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  typeLabel(type: string): string {
    const found = this.typesDisponibles.find(t => t.value === type);
    return found ? found.label : type;
  }
}
