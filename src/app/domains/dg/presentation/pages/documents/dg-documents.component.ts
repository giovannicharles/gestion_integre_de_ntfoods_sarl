import { Component, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { DocumentService } from '../../../../shared/infrastructure/document.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface ArchivedDoc {
  typeDocument: string;
  reference: string;
  storageKey: string;
  dateImport: Date;
}

@Component({
  selector: 'app-dg-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dg-documents.component.html',
  styleUrls: ['./dg-documents.component.css']
})
export class DgDocumentsComponent implements OnDestroy {
  private d$ = new Subject<void>();
  private svc = inject(DocumentService);

  typeDocument = 'FACTURE';
  reference = '';
  selectedFile: File | null = null;
  uploading = signal(false);
  documents = signal<ArchivedDoc[]>([]);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  docTypes = [
    { value: 'FACTURE', label: 'Facture' },
    { value: 'AVOIR', label: 'Avoir' },
    { value: 'BON_LIVRAISON', label: 'Bon de livraison' },
    { value: 'BON_RECEPTION', label: 'Bon de réception' },
    { value: 'CONTRAT', label: 'Contrat' },
    { value: 'AUTRE', label: 'Autre' },
  ];

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.selectedFile = input.files[0];
  }

  importer(): void {
    if (this.uploading() || !this.selectedFile || !this.reference) return;
    this.uploading.set(true);
    this.svc.importer(this.typeDocument, this.reference, this.selectedFile).pipe(takeUntil(this.d$)).subscribe({
      next: (key) => {
        this.documents.update(list => [{
          typeDocument: this.typeDocument,
          reference: this.reference,
          storageKey: key,
          dateImport: new Date(),
        }, ...list]);
        this.uploading.set(false);
        this.selectedFile = null;
        this.reference = '';
        this.showToast('Document archivé avec succès.', 'success');
      },
      error: (e) => { this.uploading.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  telecharger(doc: ArchivedDoc): void {
    this.svc.recuperer(doc.typeDocument, doc.reference).pipe(takeUntil(this.d$)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.typeDocument}_${doc.reference}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (e) => this.showToast(extractApiError(e), 'error'),
    });
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy(): void { this.d$.next(); this.d$.complete(); }
}
