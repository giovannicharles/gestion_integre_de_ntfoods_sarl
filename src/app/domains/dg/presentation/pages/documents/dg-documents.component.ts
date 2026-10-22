import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService, DocumentArchiveBE, TYPES_DOCUMENT } from '../../../../shared/infrastructure/document.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { EmptyIllustrationComponent } from '../../../../../shared/components/empty-illustration/empty-illustration.component';

/**
 * Archivage documentaire — réécrit le 2026-10-16. L'écran précédent perdait sa liste à
 * chaque rechargement (aucun endpoint de liste n'existait côté serveur), son
 * téléchargement n'a jamais fonctionné (il envoyait typeDocument+reference, le serveur
 * n'attendait qu'une clé), et la moitié des types proposés (Avoir, Contrat, Autre)
 * étaient refusés par le serveur (hors de la liste blanche réelle) — tout est corrigé.
 */
@Component({
  selector: 'app-dg-documents',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, EmptyIllustrationComponent],
  templateUrl: './dg-documents.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DgDocumentsComponent implements OnInit {
  private readonly svc = inject(DocumentService);
  private readonly toast = inject(ToastService);

  docTypes = TYPES_DOCUMENT;
  typeDocument = 'FACTURE';
  reference = '';
  selectedFile: File | null = null;
  uploading = signal(false);

  loading = signal(true);
  loadError = signal<string | null>(null);
  documents = signal<DocumentArchiveBE[]>([]);
  filtreType = signal<string>('TOUS');

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.rechercher().subscribe({
      next: docs => { this.documents.set(docs); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  listeFiltree(): DocumentArchiveBE[] {
    const f = this.filtreType();
    return f === 'TOUS' ? this.documents() : this.documents().filter(d => d.typeDocument === f);
  }

  libelleType(code: string): string {
    return this.docTypes.find(t => t.value === code)?.label ?? code;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.selectedFile = input.files[0];
  }

  importer(): void {
    if (this.uploading() || !this.selectedFile || !this.reference.trim()) return;
    this.uploading.set(true);
    this.svc.importer(this.typeDocument, this.reference.trim(), this.selectedFile).subscribe({
      next: doc => {
        this.uploading.set(false);
        this.documents.update(list => [doc, ...list]);
        this.selectedFile = null;
        this.reference = '';
        this.toast.success(`Document "${doc.nomFichierOriginal}" archivé.`);
      },
      error: e => { this.uploading.set(false); this.toast.error(extractApiError(e), "Échec de l'archivage"); },
    });
  }

  telecharger(doc: DocumentArchiveBE): void {
    this.svc.telecharger(doc.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.nomFichierOriginal || `document-${doc.id}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: e => this.toast.error(extractApiError(e), 'Échec du téléchargement'),
    });
  }

  tailleLisible(octets: number): string {
    if (octets < 1024) return octets + ' o';
    if (octets < 1024 * 1024) return (octets / 1024).toFixed(1) + ' Ko';
    return (octets / (1024 * 1024)).toFixed(1) + ' Mo';
  }
}
