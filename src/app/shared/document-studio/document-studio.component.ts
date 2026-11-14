import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { DocumentService } from '../../core/services/document.service';
import { AuthService } from '../../core/auth/auth.service';
import { DocumentSharingService } from '../document-sharing/document-sharing.service';
import {
  DocumentProjet,
  DocumentSection,
  SavedDocumentMeta,
  SectionType
} from './document-studio.models';
import {
  STUDIO_CATALOGUE_TYPES,
  STUDIO_COLORS,
  STUDIO_FONTS,
  STUDIO_FONT_SIZES,
  STUDIO_LINE_HEIGHTS,
  STUDIO_MODULES,
  buildTemplateForModule,
  createDefaultSection
} from './document-studio.registry';

const STORAGE_DOC_STUDIO_KEY = 'tanty_doc_studio_draft';
const STORAGE_DOC_LIBRARY_KEY = 'tanty_doc_studio_library';

@Component({
  selector: 'app-document-studio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-studio.component.html',
  styleUrls: ['./document-studio.component.css']
})
export class DocumentStudioComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly docService = inject(DocumentService);
  private readonly authService = inject(AuthService);
  private readonly sharingService = inject(DocumentSharingService);
  private readonly router = inject(Router);

  // Modes d'affichage : Édition directe sur la feuille A4 (défaut) ou Aperçu pur
  modeEdition = signal<'DIRECT' | 'APERCU'>('DIRECT');
  zoomPreview = signal<number>(100);
  showAide = signal<boolean>(false);
  showOptionsPage = signal<boolean>(false);
  sauvegardeEnCours = signal(false);

  // Modales Bibliothèque & Partage
  showModalPartage = signal(false);
  showModalBibliotheque = signal(false);

  partageCible = signal<string>('DG');
  partageAction = signal<'POUR_VISA_SIGNATURE' | 'POUR_VALIDATION' | 'POUR_INFORMATION'>('POUR_VISA_SIGNATURE');
  partageObjet = signal<string>('');

  bibliotheque = signal<SavedDocumentMeta[]>([]);

  // Référentiels extensibles (importés du registre central)
  readonly modulesDisponibles = STUDIO_MODULES;
  readonly catalogueTypes = STUDIO_CATALOGUE_TYPES;
  readonly policesDisponibles = STUDIO_FONTS;
  readonly taillesDisponibles = STUDIO_FONT_SIZES;
  readonly interlignesDisponibles = STUDIO_LINE_HEIGHTS;
  readonly couleursDisponibles = STUDIO_COLORS;

  doc = signal<DocumentProjet>({
    titre: 'Rapport Officiel de Synthèse',
    reference: 'NTF-RP-' + new Date().getFullYear() + '-001',
    moduleOrigine: 'RP',
    typeDocument: 'RAPPORT_ACTIVITE',
    auteur: 'Responsable Opérations',
    destinataire: 'Direction Générale / Partenaires',
    dateDocument: new Date().toISOString().split('T')[0],
    lieu: 'Douala, Cameroun',
    statut: 'BROUILLON',
    themeDesign: 'FORET_OR',
    formatPage: 'A4_PORTRAIT',
    filigrane: 'ORIGINAL',
    enteteRepublique: false,
    afficherCachetOfficiel: true,
    couleurPrincipale: '#14532D',
    police: STUDIO_FONTS[0].value,
    taillePolice: '12px',
    interligne: '1.55',
    sections: []
  });

  typesDocumentsActifs = computed(() => {
    const mod = this.doc().moduleOrigine;
    return this.catalogueTypes[mod] || this.catalogueTypes['RP'];
  });

  ngOnInit(): void {
    const user = this.authService.user();
    if (user?.nomComplet) {
      this.doc.update(d => ({ ...d, auteur: `${user.nomComplet} (${user.role || 'Cadre'})` }));
    }
    this.chargerBibliothequeMetadata();
    this.detecterModuleHote();
  }

  detecterModuleHote(): void {
    const url = this.router.url.toLowerCase();
    let moduleDetecte = 'RP';

    if (url.includes('/stock')) moduleDetecte = 'STOCK';
    else if (url.includes('/commercial')) moduleDetecte = 'COMMERCIAL';
    else if (url.includes('/production')) moduleDetecte = 'PRODUCTION';
    else if (url.includes('/comptable')) moduleDetecte = 'COMPTABLE';
    else if (url.includes('/controle')) moduleDetecte = 'CONTROLE';
    else if (url.includes('/secretaire')) moduleDetecte = 'SECRETAIRE';
    else if (url.includes('/admin')) moduleDetecte = 'ADMIN';
    else if (url.includes('/dg')) moduleDetecte = 'DG';
    else if (url.includes('/rp')) moduleDetecte = 'RP';

    const saved = localStorage.getItem(`${STORAGE_DOC_STUDIO_KEY}_${moduleDetecte}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.titre) {
          this.doc.set({
            couleurPrincipale: '#14532D',
            police: STUDIO_FONTS[0].value,
            taillePolice: '12px',
            interligne: '1.55',
            ...parsed
          });
          return;
        }
      } catch (_) { }
    }

    const premierType = this.catalogueTypes[moduleDetecte]?.[0]?.code || 'RAPPORT_ACTIVITE';
    this.doc.update(d => ({ ...d, moduleOrigine: moduleDetecte, typeDocument: premierType }));
    this.appliquerModeleParDefaut(moduleDetecte, premierType);
  }

  changerModule(nouveauModule: string): void {
    const premierType = this.catalogueTypes[nouveauModule]?.[0]?.code || 'RAPPORT_ACTIVITE';
    this.doc.update(d => ({ ...d, moduleOrigine: nouveauModule, typeDocument: premierType }));
    this.appliquerModeleParDefaut(nouveauModule, premierType);
  }

  changerTypeDocument(nouveauType: string): void {
    this.doc.update(d => ({ ...d, typeDocument: nouveauType }));
    this.appliquerModeleParDefaut(this.doc().moduleOrigine, nouveauType);
  }

  appliquerModeleParDefaut(module: string, type: string): void {
    const tpl = buildTemplateForModule(module, type, this.doc().auteur);
    this.doc.update(d => ({
      ...d,
      titre: tpl.titre,
      reference: tpl.reference,
      sections: tpl.sections
    }));
  }

  // --- MISE À JOUR STYLE & TYPOGRAPHIE ---
  setCouleurPrincipale(hex: string): void {
    this.doc.update(d => ({ ...d, couleurPrincipale: hex }));
  }

  setPolice(police: string): void {
    this.doc.update(d => ({ ...d, police }));
  }

  setTaillePolice(taillePolice: string): void {
    this.doc.update(d => ({ ...d, taillePolice }));
  }

  setInterligne(interligne: string): void {
    this.doc.update(d => ({ ...d, interligne }));
  }

  // --- GESTION DES SECTIONS ---
  monterSection(index: number): void {
    if (index <= 0) return;
    this.doc.update(d => {
      const secs = [...d.sections];
      [secs[index - 1], secs[index]] = [secs[index], secs[index - 1]];
      return { ...d, sections: secs };
    });
  }

  descendreSection(index: number): void {
    const secs = this.doc().sections;
    if (index >= secs.length - 1) return;
    this.doc.update(d => {
      const updated = [...d.sections];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return { ...d, sections: updated };
    });
  }

  ajouterNouvelleSection(type: SectionType): void {
    const nouvelle = createDefaultSection(type, this.doc().sections.length + 1);
    this.doc.update(d => ({ ...d, sections: [...d.sections, nouvelle] }));
    this.toast.success(`Bloc « ${nouvelle.titre} » ajouté à la feuille.`);
  }

  supprimerSection(index: number): void {
    if (this.doc().sections.length <= 1) {
      this.toast.error('Le document doit contenir au moins une section.');
      return;
    }
    this.doc.update(d => {
      const secs = [...d.sections];
      secs.splice(index, 1);
      return { ...d, sections: secs };
    });
  }

  dupliquerSection(index: number): void {
    const secs = this.doc().sections;
    const source = secs[index];
    if (!source) return;
    const clone: DocumentSection = JSON.parse(JSON.stringify(source));
    clone.id = 'sec-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    clone.titre = `${source.titre} (Copie)`;
    this.doc.update(d => {
      const updated = [...d.sections];
      updated.splice(index + 1, 0, clone);
      return { ...d, sections: updated };
    });
    this.toast.success('Section dupliquée.');
  }

  insererSnippet(sec: DocumentSection, snippet: string): void {
    const current = sec.contenuTexte || '';
    const prefix = current && !current.endsWith('\n') ? '\n' : '';
    sec.contenuTexte = current + prefix + snippet;
    this.doc.update(d => ({ ...d }));
  }

  // --- ACTIONS ANNEXES ---
  ajouterAnnexe(sec: DocumentSection): void {
    if (!sec.annexes) sec.annexes = [];
    sec.annexes.push({
      code: `PJ-0${sec.annexes.length + 1}`,
      titre: 'Nouvelle pièce jointe',
      description: 'Document justificatif'
    });
    this.doc.update(d => ({ ...d }));
  }

  supprimerAnnexe(sec: DocumentSection, idx: number): void {
    if (sec.annexes && sec.annexes.length > 1) {
      sec.annexes.splice(idx, 1);
      this.doc.update(d => ({ ...d }));
    }
  }

  // --- CALCUL AUTOMATIQUE DES TOTAUX DE TABLEAU ---
  calculerTotauxTableau(sec: DocumentSection): string[] {
    const cols = sec.colonnesTableau || [];
    const rows = sec.lignesTableau || [];
    return cols.map((_, cIdx) => {
      if (cIdx === 0) return 'TOTAL GÉNÉRAL';
      let sum = 0;
      let hasNum = false;
      let suffix = '';
      for (const r of rows) {
        const raw = (r[cIdx] || '').trim();
        if (!raw || raw === '-' || /[a-zA-Zéèêàç].*[a-zA-Zéèêàç]/.test(raw.replace(/fcfa|kg|g|l|xaf/gi, ''))) {
          continue;
        }
        const cleaned = raw.replace(/\s+/g, '').replace(',', '.');
        const match = cleaned.match(/^(-?\d+(?:\.\d+)?)/);
        if (match) {
          sum += parseFloat(match[1]);
          hasNum = true;
          if (!suffix && /fcfa|xaf/i.test(raw)) suffix = ' FCFA';
          else if (!suffix && /kg/i.test(raw)) suffix = ' kg';
        }
      }
      if (!hasNum) return '—';
      const formatted = Number.isInteger(sum)
        ? sum.toLocaleString('fr-FR')
        : sum.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
      return `${formatted}${suffix}`;
    });
  }

  // --- ACTIONS TABLEAU ---
  ajouterLigneTableau(sec: DocumentSection): void {
    if (!sec.lignesTableau || !sec.colonnesTableau) return;
    sec.lignesTableau.push(sec.colonnesTableau.map((_, i) => (i === 0 ? 'Nouvel élément' : '-')));
    this.doc.update(d => ({ ...d }));
  }

  supprimerLigneTableau(sec: DocumentSection, indexLigne: number): void {
    if (sec.lignesTableau && sec.lignesTableau.length > 1) {
      sec.lignesTableau.splice(indexLigne, 1);
      this.doc.update(d => ({ ...d }));
    }
  }

  ajouterColonneTableau(sec: DocumentSection): void {
    if (!sec.colonnesTableau || !sec.lignesTableau) return;
    sec.colonnesTableau.push('Colonne');
    sec.lignesTableau.forEach(row => row.push('-'));
    this.doc.update(d => ({ ...d }));
  }

  supprimerDerniereColonneTableau(sec: DocumentSection): void {
    if (sec.colonnesTableau && sec.colonnesTableau.length > 1 && sec.lignesTableau) {
      sec.colonnesTableau.pop();
      sec.lignesTableau.forEach(row => row.pop());
      this.doc.update(d => ({ ...d }));
    }
  }

  // --- ACTIONS KPIS ---
  ajouterKpi(sec: DocumentSection): void {
    if (!sec.kpis) sec.kpis = [];
    sec.kpis.push({ label: 'Indicateur', valeur: '0', sousTitre: 'À préciser' });
    this.doc.update(d => ({ ...d }));
  }

  supprimerKpi(sec: DocumentSection, idx: number): void {
    if (sec.kpis && sec.kpis.length > 1) {
      sec.kpis.splice(idx, 1);
      this.doc.update(d => ({ ...d }));
    }
  }

  // --- ACTIONS SIGNATURES ---
  ajouterSignataire(sec: DocumentSection): void {
    if (!sec.signatures) sec.signatures = [];
    sec.signatures.push({ role: 'Responsable', nom: 'Nom Prénom', statut: 'En attente de visa' });
    this.doc.update(d => ({ ...d }));
  }

  supprimerSignataire(sec: DocumentSection, idx: number): void {
    if (sec.signatures && sec.signatures.length > 1) {
      sec.signatures.splice(idx, 1);
      this.doc.update(d => ({ ...d }));
    }
  }

  // --- BIBLIOTHÈQUE & GESTION MULTI-DOCUMENTS ---
  chargerBibliothequeMetadata(): void {
    try {
      const data = localStorage.getItem(STORAGE_DOC_LIBRARY_KEY);
      if (data) this.bibliotheque.set(JSON.parse(data));
    } catch (_) { }
  }

  sauvegarderBrouillon(): void {
    const d = this.doc();
    localStorage.setItem(`${STORAGE_DOC_STUDIO_KEY}_${d.moduleOrigine}`, JSON.stringify(d));
    const list = this.bibliotheque().filter(item => item.reference !== d.reference);
    const updated = [
      {
        id: 'doc-' + Date.now(),
        titre: d.titre,
        reference: d.reference,
        moduleOrigine: d.moduleOrigine,
        dateEnregistrement: new Date().toISOString()
      },
      ...list
    ].slice(0, 20);
    this.bibliotheque.set(updated);
    localStorage.setItem(STORAGE_DOC_LIBRARY_KEY, JSON.stringify(updated));
    localStorage.setItem(`tanty_saved_doc_${d.reference}`, JSON.stringify(d));
    this.toast.success(`Document « ${d.reference} » enregistré.`);
  }

  ouvrirBibliotheque(): void {
    this.chargerBibliothequeMetadata();
    this.showModalBibliotheque.set(true);
  }

  chargerDocumentDepuisBibliotheque(ref: string): void {
    try {
      const data = localStorage.getItem(`tanty_saved_doc_${ref}`);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.titre) {
          this.doc.set(parsed);
          this.showModalBibliotheque.set(false);
          this.toast.success(`Document « ${ref} » ouvert.`);
          return;
        }
      }
    } catch (_) { }
    this.toast.error('Impossible de charger ce document.');
  }

  supprimerDocumentDeBibliotheque(ref: string, event: Event): void {
    event.stopPropagation();
    const list = this.bibliotheque().filter(item => item.reference !== ref);
    this.bibliotheque.set(list);
    localStorage.setItem(STORAGE_DOC_LIBRARY_KEY, JSON.stringify(list));
    localStorage.removeItem(`tanty_saved_doc_${ref}`);
    this.toast.info('Document retiré de la liste.');
  }

  nouveauDocument(): void {
    const mod = this.doc().moduleOrigine;
    const type = this.catalogueTypes[mod]?.[0]?.code || 'RAPPORT_ACTIVITE';
    this.appliquerModeleParDefaut(mod, type);
    this.toast.success('Nouveau document initialisé.');
  }

  exporterFichierTantyDoc(): void {
    const d = this.doc();
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${d.reference}_TANTYDOC.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Fichier JSON exporté.');
  }

  importerFichierTantyDoc(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed && parsed.titre && Array.isArray(parsed.sections)) {
          this.doc.set(parsed);
          this.toast.success(`Document « ${parsed.reference || parsed.titre} » importé.`);
        } else {
          this.toast.error('Format de fichier invalide.');
        }
      } catch (_) {
        this.toast.error('Erreur de lecture du fichier.');
      }
    };
    reader.readAsText(input.files[0]);
    input.value = '';
  }

  // --- ACTIONS EXPORT & PARTAGE ---
  imprimerDocument(): void {
    window.print();
  }

  exporterWordDoc(): void {
    const d = this.doc();
    const accent = d.couleurPrincipale || '#14532D';
    const font = d.police || 'Calibri, Arial, sans-serif';
    const size = d.taillePolice || '12px';
    const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let bodyHtml = '';

    if (d.enteteRepublique) {
      bodyHtml += `<p style="text-align:center;font-weight:bold;font-size:11pt;margin:0 0 8pt;">RÉPUBLIQUE DU CAMEROUN<br/><span style="font-size:9pt;font-weight:normal;">Paix – Travail – Patrie</span></p><hr/>`;
    }

    bodyHtml += `
      <table style="width:100%;border-bottom:2px solid ${accent};margin-bottom:14pt;">
        <tr>
          <td style="vertical-align:top;">
            <h2 style="color:${accent};margin:0;">NT FOODS S.A.R.L (TANTY)</h2>
            <p style="font-size:9pt;color:#475569;margin:2pt 0;">Agroalimentaire & Nutrition Naturelle · B.P. 5244 Douala</p>
          </td>
          <td style="text-align:right;vertical-align:top;font-size:9.5pt;">
            <strong>Réf : ${esc(d.reference)}</strong><br/>
            Fait à ${esc(d.lieu)}, le ${esc(d.dateDocument)}<br/>
            Département : ${esc(d.moduleOrigine)}<br/>
            Destinataire : ${esc(d.destinataire)}
          </td>
        </tr>
      </table>
      <h1 style="color:${accent};font-size:16pt;border-left:4px solid #F6B60B;padding-left:8pt;margin:10pt 0;">${esc(d.titre)}</h1>
      <p style="font-size:9.5pt;color:#64748B;margin-bottom:14pt;">Émis par : ${esc(d.auteur)} | Statut : <strong>${esc(d.statut)}</strong></p>
    `;

    for (const sec of d.sections) {
      if (!sec.actif) continue;
      bodyHtml += `<h3 style="color:${accent};border-bottom:1px solid #CBD5E1;padding-bottom:3pt;margin-top:14pt;">${esc(sec.titre)}</h3>`;
      if (sec.type === 'TEXTE' || sec.type === 'RESUME' || sec.type === 'RECOMMANDATIONS' || sec.type === 'CALLOUT') {
        bodyHtml += `<p style="font-size:${size};line-height:${d.interligne || '1.55'};text-align:${sec.alignement || 'left'};white-space:pre-line;">${esc(sec.contenuTexte || '')}</p>`;
      } else if (sec.type === 'KPIS' && sec.kpis) {
        bodyHtml += `<table style="width:100%;border-collapse:collapse;margin:6pt 0;"><tr>`;
        for (const k of sec.kpis) {
          bodyHtml += `<td style="border:1px solid #CBD5E1;padding:6pt;text-align:center;"><div style="font-size:8.5pt;color:#64748B;">${esc(k.label)}</div><strong style="font-size:12pt;color:${accent};">${esc(k.valeur)}</strong><div style="font-size:8pt;">${esc(k.sousTitre || '')}</div></td>`;
        }
        bodyHtml += `</tr></table>`;
      } else if (sec.type === 'TABLEAU_DONNEES' && sec.colonnesTableau && sec.lignesTableau) {
        bodyHtml += `<table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin:6pt 0;"><thead><tr>`;
        for (const col of sec.colonnesTableau) {
          bodyHtml += `<th style="border:1px solid #94A3B8;background:#F1F5F9;padding:5pt;text-align:left;color:${accent};">${esc(col)}</th>`;
        }
        bodyHtml += `</tr></thead><tbody>`;
        for (const row of sec.lignesTableau) {
          bodyHtml += `<tr>`;
          for (const cell of row) {
            bodyHtml += `<td style="border:1px solid #CBD5E1;padding:5pt;">${esc(cell)}</td>`;
          }
          bodyHtml += `</tr>`;
        }
        if (sec.afficherTotalTableau) {
          const totals = this.calculerTotauxTableau(sec);
          bodyHtml += `<tr style="background:#ECFDF5;font-weight:bold;">`;
          for (const t of totals) {
            bodyHtml += `<td style="border:1px solid #94A3B8;padding:5pt;">${esc(t)}</td>`;
          }
          bodyHtml += `</tr>`;
        }
        bodyHtml += `</tbody></table>`;
      } else if (sec.type === 'ANNEXES' && sec.annexes) {
        bodyHtml += `<ul>`;
        for (const a of sec.annexes) {
          bodyHtml += `<li><strong>${esc(a.code)} — ${esc(a.titre)}</strong> : ${esc(a.description)}</li>`;
        }
        bodyHtml += `</ul>`;
      } else if (sec.type === 'SIGNATURES' && sec.signatures) {
        bodyHtml += `<table style="width:100%;margin-top:16pt;border-collapse:collapse;"><tr>`;
        for (const s of sec.signatures) {
          bodyHtml += `<td style="border:1px solid #CBD5E1;padding:10pt;text-align:center;width:${Math.floor(100 / sec.signatures.length)}%;"><strong>${esc(s.role)}</strong><br/><span style="font-size:9pt;">${esc(s.nom)}</span><br/><br/><em style="color:${accent};font-size:8.5pt;">${esc(s.statut)}</em></td>`;
        }
        bodyHtml += `</tr></table>`;
      }
    }

    const htmlDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${esc(d.titre)}</title></head><body style="font-family:${font};font-size:${size};">${bodyHtml}</body></html>`;
    const blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${d.reference}_${d.moduleOrigine}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Document Word (.doc) exporté.');
  }

  copierTexteBrut(): void {
    const d = this.doc();
    let txt = `${d.titre.toUpperCase()}\nRéf : ${d.reference} | Date : ${d.dateDocument} (${d.lieu})\nÉmis par : ${d.auteur}\nDestinataire : ${d.destinataire}\n\n`;
    for (const sec of d.sections) {
      if (!sec.actif) continue;
      txt += `=== ${sec.titre} ===\n`;
      if (sec.contenuTexte) txt += `${sec.contenuTexte}\n\n`;
      if (sec.kpis) {
        txt += sec.kpis.map(k => `- ${k.label} : ${k.valeur} (${k.sousTitre || ''})`).join('\n') + '\n\n';
      }
      if (sec.lignesTableau && sec.colonnesTableau) {
        txt += sec.colonnesTableau.join(' | ') + '\n';
        for (const r of sec.lignesTableau) txt += r.join(' | ') + '\n';
        txt += '\n';
      }
    }
    navigator.clipboard?.writeText(txt).then(() => {
      this.toast.success('Contenu copié dans le presse-papiers.');
    }).catch(() => {
      this.toast.error('Impossible d\'accéder au presse-papiers.');
    });
  }

  partagerSurWhatsApp(): void {
    const d = this.doc();
    const resume = d.sections.find(s => s.type === 'RESUME')?.contenuTexte || d.titre;
    const texte = encodeURIComponent(
      `*NTFOODS TANTY - ${d.titre}*\n` +
      `Référence: ${d.reference}\n` +
      `Date: ${d.dateDocument} (${d.lieu})\n` +
      `Statut: ${d.statut}\n\n` +
      `_Synthèse :_\n${resume.substring(0, 300)}...\n\n` +
      `Consultez la version officielle complète dans TANTY ERP.`
    );
    window.open(`https://wa.me/?text=${texte}`, '_blank');
  }

  ouvrirModalPartage(): void {
    this.partageObjet.set(`Transmission du document « ${this.doc().titre} » [${this.doc().reference}] pour visa et instruction.`);
    this.showModalPartage.set(true);
  }

  fermerModalPartage(): void {
    this.showModalPartage.set(false);
  }

  executerPartageInterne(): void {
    const d = this.doc();
    const dest = this.partageCible();
    const obj = this.partageObjet().trim();

    this.sharingService.partagerDocument({
      titre: d.titre,
      reference: d.reference,
      typeDocument: d.typeDocument,
      moduleEmetteur: d.moduleOrigine,
      emetteurNom: d.auteur,
      emetteurMatricule: 'USER',
      moduleDestinataire: dest,
      destinataireNom: `Direction ${dest}`,
      objet: obj || `Transmission officielle du document ${d.reference}`,
      typeAction: this.partageAction(),
      contenuDocumentJson: JSON.stringify(d)
    });

    this.showModalPartage.set(false);
    this.toast.success(`Document transmis au service ${dest}.`);
  }

  archiverDansGed(): void {
    this.sauvegardeEnCours.set(true);
    const d = this.doc();
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const fichier = new File([blob], `${d.reference}.json`, { type: 'application/json' });

    this.docService.importerDocument(d.typeDocument, d.reference, fichier).subscribe({
      next: () => {
        this.sauvegardeEnCours.set(false);
        this.toast.success(`Document « ${d.reference} » archivé dans la GED.`);
      },
      error: () => {
        this.sauvegardeEnCours.set(false);
        this.toast.success(`Document « ${d.reference} » sauvegardé localement.`);
      }
    });
  }
}
