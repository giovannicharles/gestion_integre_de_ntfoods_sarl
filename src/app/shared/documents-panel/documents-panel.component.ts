import { Component, OnInit, input, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService, DocumentArchiveBE, TYPES_DOCUMENT } from '../../domains/shared/infrastructure/document.service';
import { ToastService } from '../../core/services/toast.service';
import { extractApiError } from '../../core/http/api-error-parser';

/**
 * Panneau de pièces jointes, réutilisable partout (2026-10-16) : un module n'a plus
 * besoin de réinventer l'upload/liste/téléchargement — il dépose <app-documents-panel>
 * avec son entityType/entityId, et obtient les documents liés à CETTE entité précise
 * (incident, facture, décaissement, avarie...). S'appuie sur DocumentArchiveService
 * (backend), premier et seul point d'écriture documentaire.
 */
@Component({
  selector: 'app-documents-panel',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './documents-panel.component.html',
})
export class DocumentsPanelComponent implements OnInit {
  private readonly svc = inject(DocumentService);
  private readonly toast = inject(ToastService);

  /** Entité métier à laquelle les documents de ce panneau sont rattachés (ex. "INCIDENT"). */
  entityType = input.required<string>();
  entityId = input.required<number>();
  /** Type de document présélectionné à l'import (ex. "PHOTO_AVARIE" dans un formulaire d'avarie). */
  defaultType = input<string>('RAPPORT');
  /** Restreint la liste déroulante — par défaut, tous les types autorisés côté serveur. */
  typesAutorises = input<string[] | null>(null);
  /** Titre affiché en tête de panneau. */
  titre = input('Pièces jointes');
  compact = input(false);

  docTypesDisponibles = computed(() => {
    const restriction = this.typesAutorises();
    return restriction ? TYPES_DOCUMENT.filter(t => restriction.includes(t.value)) : TYPES_DOCUMENT;
  });

  loading = signal(true);
  loadError = signal<string | null>(null);
  documents = signal<DocumentArchiveBE[]>([]);

  showForm = signal(false);
  typeChoisi = signal('');
  referenceChoisie = signal('');
  selectedFile: File | null = null;
  uploading = signal(false);

  ngOnInit(): void {
    this.typeChoisi.set(this.defaultType());
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.listerParEntite(this.entityType(), this.entityId()).subscribe({
      next: docs => { this.documents.set(docs); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  libelleType(code: string): string {
    return TYPES_DOCUMENT.find(t => t.value === code)?.label ?? code;
  }

  ouvrirForm(): void {
    this.typeChoisi.set(this.defaultType());
    this.referenceChoisie.set(`${this.entityType()}-${this.entityId()}`);
    this.selectedFile = null;
    this.showForm.set(true);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.selectedFile = input.files[0];
  }

  importer(): void {
    if (this.uploading() || !this.selectedFile || !this.referenceChoisie().trim()) return;
    this.uploading.set(true);
    this.svc.importer(
      this.typeChoisi(), this.referenceChoisie().trim(), this.selectedFile,
      this.entityType(), this.entityId()
    ).subscribe({
      next: doc => {
        this.uploading.set(false);
        this.showForm.set(false);
        this.documents.update(list => [doc, ...list]);
        this.toast.success(`"${doc.nomFichierOriginal}" ajouté.`);
      },
      error: e => { this.uploading.set(false); this.toast.error(extractApiError(e), "Échec de l'ajout"); },
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
