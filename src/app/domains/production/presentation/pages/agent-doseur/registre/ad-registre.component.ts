import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, SessionDosageBE } from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

type Presence = 'SEMAINE' | 'MOIS' | 'TRIMESTRE';
type Statut = 'CLOTUREE' | 'VALIDEE' | 'EN_PAUSE' | 'EN_COURS';

/**
 * REGISTRE DE DOSAGE — Agent Doseur.
 * Liste des sessions de dosage d'une période (filtrable, recherchable), avec leurs totaux
 * (fûts produits, fûts cassés, matières) et leur statut. Chaque session se déploie pour voir le
 * détail des matières et la justification d'écart, et se télécharge en PDF ou en Excel.
 */
@Component({
  selector: 'app-ad-registre',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './ad-registre.component.html',
  styleUrls: ['./ad-registre.component.css'],
})
export class AdRegistreComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();

  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly sessions = signal<SessionDosageBE[]>([]);

  readonly recherche = signal('');
  readonly statutFiltre = signal<'TOUS' | Statut>('TOUS');
  readonly debut = signal(ajouterJours(dateLocaleIso(), -13));
  readonly fin = signal(dateLocaleIso());
  readonly presenceChoisie = signal<Presence | ''>('');

  readonly ouverte = signal<number | null>(null);
  readonly telechargement = signal<string>('');
  readonly erreurTelechargement = signal('');

  readonly presets: { code: Presence; libelle: string }[] = [
    { code: 'SEMAINE', libelle: '7 jours' },
    { code: 'MOIS', libelle: '30 jours' },
    { code: 'TRIMESTRE', libelle: '90 jours' },
  ];

  /** Statut lisible d'une session : clôturée > validée > en pause > en cours. */
  statutDe(s: SessionDosageBE): Statut {
    if (s.cloturee) return 'CLOTUREE';
    if (s.validee) return 'VALIDEE';
    if (s.enPause) return 'EN_PAUSE';
    return 'EN_COURS';
  }

  readonly sessionsTriees = computed(() =>
    [...this.sessions()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));

  readonly sessionsFiltrees = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    const statut = this.statutFiltre();
    return this.sessionsTriees().filter(s =>
      (statut === 'TOUS' || this.statutDe(s) === statut) &&
      (!r || s.referencePPH.toLowerCase().includes(r) || s.matriculeAgentDoseur.toLowerCase().includes(r)));
  });

  readonly nbFiltrees = computed(() => this.sessionsFiltrees().length);
  readonly futsProduits = computed(() => this.sessionsFiltrees().reduce((t, s) => t + s.nbFutsProduits, 0));
  readonly futsCasses = computed(() => this.sessionsFiltrees().reduce((t, s) => t + s.nbFutsCasses, 0));
  readonly matieresKg = computed(() => this.sessionsFiltrees()
    .reduce((t, s) => t + s.matieresUtilisees.reduce((u, m) => u + m.quantiteKg, 0), 0));
  readonly nbAvecEcart = computed(() => this.sessionsFiltrees().filter(s => !!s.justificationEcart).length);

  ngOnInit(): void {
    this.charger();
  }

  choisirPresence(code: Presence): void {
    this.presenceChoisie.set(code);
    const jours = code === 'SEMAINE' ? 6 : code === 'MOIS' ? 29 : 89;
    this.debut.set(ajouterJours(this.aujourdhui, -jours));
    this.fin.set(this.aujourdhui);
    this.charger();
  }

  charger(): void {
    if (!this.debut() || !this.fin() || this.debut() > this.fin()) {
      this.erreur.set('La date de début doit être antérieure à la date de fin.');
      return;
    }
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getSessionsDosageParPeriode(this.debut(), this.fin()).subscribe({
      next: s => { this.sessions.set(s); this.chargement.set(false); },
      error: (e: unknown) => {
        this.noterErreur(e, 'Le registre n\'a pas pu être chargé.');
        this.chargement.set(false);
      },
    });
  }

  sommeMatieres(s: SessionDosageBE): number {
    return s.matieresUtilisees.reduce((t, m) => t + m.quantiteKg, 0);
  }

  basculer(id: number): void {
    this.ouverte.set(this.ouverte() === id ? null : id);
  }

  telecharger(s: SessionDosageBE, format: 'pdf' | 'excel'): void {
    const cle = `${s.id}-${format}`;
    this.telechargement.set(cle);
    this.erreurTelechargement.set('');
    this.svc.telechargerRegistreDosage(s.id, format).subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registre-dosage-${s.id}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.telechargement.set('');
      },
      error: (e: unknown) => {
        this.noterErreur(e, 'Le téléchargement du registre a échoué.', true);
        this.telechargement.set('');
      },
    });
  }

  private noterErreur(e: unknown, repli: string, versTelechargement = false): void {
    const statut = (e as { status?: number })?.status;
    if (statut === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    if (versTelechargement) this.erreurTelechargement.set(repli);
    else this.erreur.set(repli);
  }
}
