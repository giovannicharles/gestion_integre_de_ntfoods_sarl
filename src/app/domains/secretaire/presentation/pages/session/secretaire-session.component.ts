import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ComptableService, VersementBE, CaisseBE } from '../../../../comptable/infrastructure/comptable.service';
import { StockService, SessionCommercialBE } from '../../../../stock/infrastructure/stock.service';
import { CanDirective } from '../../../../../shared/directives/can.directive';
import { ToastService } from '../../../../../core/services/toast.service';

interface VersementUI {
  id: string; commercialId: string; date: Date;
  montantAttendu: number; cashVerse: number; ecart: number; statut: string;
  typeVersement: string | null; heureVersement: string | null; alerteRouge: boolean;
  justificationEcart: string | null;
}

@Component({
  selector: 'app-secretaire-session',
  standalone: true,
  imports: [CommonModule, DatePipe, CanDirective],
  templateUrl: './secretaire-session.component.html',
  styleUrls: ['./secretaire-session.component.css']
})
export class SecretaireSessionComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(ComptableService);
  private readonly stockSvc = inject(StockService);
  private readonly toast = inject(ToastService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  loading = signal(false);
  traitementEnCours = signal<string | null>(null);
  message = signal<{ texte: string; type: 'succes' | 'erreur' } | null>(null);

  versements = signal<VersementUI[]>([]);
  caisse = signal<CaisseBE | null>(null);
  sessionsARapprocher = signal<SessionCommercialBE[]>([]);

  // Modal d'impression feuille de rapprochement
  showImpressionRapprochement = signal(false);

  totalVerse = computed(() => this.versements().reduce((s, v) => s + v.cashVerse, 0));
  totalAttendu = computed(() => this.versements().reduce((s, v) => s + v.montantAttendu, 0));
  ecartSession = computed(() => this.totalVerse() - this.totalAttendu());
  nbAlertes = computed(() => this.versements().filter(v => v.alerteRouge).length);
  soldeCaisse = computed(() => this.caisse()?.soldeCourant ?? 0);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    const jour = this.fmtDate(new Date());
    this.loading.set(true);

    forkJoin({
      versements: this.svc.getVersements({ date: jour }).pipe(catchError(() => of([] as VersementBE[]))),
      caisse: this.svc.getCaisse(jour).pipe(catchError(() => of(null))),
      sessions: this.stockSvc.getSessionsParStatut('CLOTUREE').pipe(catchError(() => of([] as SessionCommercialBE[]))),
    }).subscribe({
      next: ({ versements, caisse, sessions }) => {
        this.versements.set(versements.map(v => this.mapVersement(v)));
        this.caisse.set(caisse);
        this.sessionsARapprocher.set(sessions || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.afficher("Les données de rapprochement n'ont pas pu être chargées.", 'erreur');
      },
    });
  }

  versementDe(matricule: string): VersementUI | undefined {
    return this.versements().find(v => v.commercialId === matricule);
  }

  valider(session: SessionCommercialBE): void {
    const versement = this.versementDe(session.matriculeCommercial);
    if (versement?.alerteRouge && !versement.justificationEcart) {
      this.afficher(
        `Écart de ${this.fCFA(versement.ecart)} non justifié pour ${session.matriculeCommercial} : `
        + `demandez la justification avant de valider.`, 'erreur');
      return;
    }

    this.traitementEnCours.set(session.numeroSession);
    this.stockSvc.validerSessionSecretaire(session.numeroSession, this.matricule()).subscribe({
      next: () => {
        this.traitementEnCours.set(null);
        this.afficher(
          `Tournée ${session.numeroSession} validée. Transmise au comptable.`, 'succes');
        this.toast.success(`Tournée ${session.numeroSession} validée et transmise.`);
        this.charger();
      },
      error: (e) => {
        this.traitementEnCours.set(null);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  ecartClass(ecart: number): string {
    if (ecart > 0) return 'ecart-pos';
    if (ecart < 0) return 'ecart-neg';
    return 'ecart-ok';
  }

  ouvrirImpression(): void {
    this.showImpressionRapprochement.set(true);
  }
  fermerImpression(): void {
    this.showImpressionRapprochement.set(false);
  }
  lancerImpression(): void {
    window.print();
  }

  exporterCsv(): void {
    let csv = 'Session;Commercial;Date_Heure;Montant_Attendu;Montant_Remis;Ecart;Statut\n';
    this.sessionsARapprocher().forEach(s => {
      const v = this.versementDe(s.matriculeCommercial);
      csv += `"${s.numeroSession}";"${s.matriculeCommercial}";"${s.heureCloture || ''}";"${v ? v.montantAttendu : 0}";"${v ? v.cashVerse : 0}";"${v ? v.ecart : 0}";"${s.statut}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapprochement_sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.info('Export CSV du rapprochement téléchargé.');
  }

  private mapVersement(v: VersementBE): VersementUI {
    const d = new Date(v.date);
    return {
      id: v.referenceVersement,
      commercialId: v.matriculeCommercial,
      date: d,
      montantAttendu: v.montantAttendu,
      cashVerse: v.cashVerse,
      ecart: v.ecart,
      statut: v.statut,
      typeVersement: v.typeVersement ?? null,
      heureVersement: d.toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' }),
      alerteRouge: v.alerteRouge,
      justificationEcart: v.justificationEcart ?? null,
    };
  }

  private afficher(texte: string, type: 'succes' | 'erreur'): void {
    this.message.set({ texte, type });
  }

  private messageErreur(e: unknown): string {
    const err = e as { error?: { message?: string; erreur?: string } };
    return err?.error?.erreur ?? err?.error?.message ?? "La validation n'a pas abouti.";
  }

  private matricule(): string {
    return this.auth.user()?.matricule ?? 'SECRETAIRE';
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
