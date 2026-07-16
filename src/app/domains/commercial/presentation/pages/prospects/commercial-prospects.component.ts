import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, ClientBE } from '../../../infrastructure/commercial.service';

interface Prospect {
  id: string; nomCommerce: string; telephone: string;
  typeEstime: string; localite: string; statut: string;
  zone: string | null; dateProspection: Date | null; notes: string | null;
}

@Component({
  selector: 'app-commercial-prospects',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './commercial-prospects.component.html',
  styleUrls: ['./commercial-prospects.component.css']
})
export class CommercialProspectsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(CommercialService);

  today = new Date();
  prospects = signal<Prospect[]>([]);
  showForm = signal(false);
  submitted = signal(false);
  loading = signal(false);
  nouveauProspect = signal({ nomCommerce: '', telephone: '', typeEstime: 'DETAILLANT', notes: '' });

  ngOnInit(): void {
    const matricule = this.auth.user()?.matricule;
    if (!matricule) return;
    this.loading.set(true);
    this.svc.getClients(matricule).subscribe({
      next: clients => {
        this.prospects.set(
          clients
            .filter(c => c.type === 'PROSPECT')
            .map(this.mapClient)
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  soumettre(): void {
    const p = this.nouveauProspect();
    if (!p.nomCommerce) return;
    const matricule = this.auth.user()?.matricule ?? '';
    this.svc.creerClient({
      nom: p.nomCommerce,
      telephone: p.telephone,
      adresse: '',
      localite: '',
      type: 'PROSPECT',
      matriculeCommercialReferent: matricule,
    }).subscribe({
      next: client => {
        this.prospects.update(list => [...list, this.mapClient(client)]);
        this.submitted.set(true);
        this.showForm.set(false);
        this.nouveauProspect.set({ nomCommerce: '', telephone: '', typeEstime: 'DETAILLANT', notes: '' });
      },
    });
  }

  private mapClient(c: ClientBE): Prospect {
    return {
      id: c.codeClient,
      nomCommerce: c.nom,
      telephone: c.telephone,
      typeEstime: c.type,
      localite: c.localite,
      statut: c.actif ? 'EN_ATTENTE_VALIDATION' : 'REFUSE',
      zone: c.localite || null,
      dateProspection: null,
      notes: null,
    };
  }
}
