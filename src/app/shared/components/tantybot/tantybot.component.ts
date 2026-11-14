import { Component, signal, ElementRef, ViewChild, AfterViewChecked, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { IaService } from '../../../core/services/ia.service';
import { catchError, of } from 'rxjs';

interface BotMessage {
  role: 'user' | 'bot';
  content: string;
  time: string;
  quickReplies?: { label: string; action: string }[];
}

export interface ModuleContextInfo {
  code: string;
  titre: string;
  badge: string;
  intro: string;
  quickReplies: { label: string; action: string }[];
  whatsappRoute: string;
}

const MODULE_CONTEXTS: Record<string, ModuleContextInfo> = {
  ADMIN: {
    code: 'ADMIN',
    titre: 'TantyBot Administration',
    badge: 'IAM & Sécurité',
    intro: 'Bonjour Administrateur ! Je supervise la conformité ISO, les comptes bloqués, la télémétrie des 6 microservices et les sauvegardes de la base PostgreSQL.',
    quickReplies: [
      { label: 'Comptes bloqués', action: 'admin_bloques' },
      { label: 'Journal audit 24h', action: 'admin_audit' },
      { label: 'État microservices', action: 'admin_sante' },
      { label: 'Sauvegarder BD', action: 'admin_backup' }
    ],
    whatsappRoute: '/admin/commandes-clients'
  },
  DG: {
    code: 'DG',
    titre: 'TantyBot Direction Générale',
    badge: 'Pilotage Exécutif',
    intro: 'Bonjour M. le Directeur Général ! Je vous assiste dans le suivi des performances opérationnelles, les arbitrages de prix et la signature des décaissements.',
    quickReplies: [
      { label: 'Synthèse du jour', action: 'dg_synthese' },
      { label: 'Arbitrages en attente', action: 'dg_arbitrage' },
      { label: 'Décaissements à valider', action: 'dg_decaissements' },
      { label: 'Performances tournées', action: 'dg_tournees' }
    ],
    whatsappRoute: '/dg/commandes-clients'
  },
  RP: {
    code: 'RP',
    titre: 'TantyBot Relations Publiques',
    badge: 'Grands Comptes GMS',
    intro: 'Bonjour ! Je vous accompagne sur le suivi des conventions DOVV, Carrefour et Santa Lucia, le calcul des primes de stimulation et le bilan des animations.',
    quickReplies: [
      { label: 'Grands Comptes GMS', action: 'rp_grands_comptes' },
      { label: 'Primes de stimulation', action: 'rp_primes' },
      { label: 'Documents & Contrats', action: 'rp_documents' },
      { label: 'Statistiques de vente', action: 'rp_stats' }
    ],
    whatsappRoute: '/rp/commandes-clients'
  },
  COMPTABLE: {
    code: 'COMPTABLE',
    titre: 'TantyBot Comptabilité',
    badge: 'Normes OHADA & Trésorerie',
    intro: 'Bonjour ! Je vous assiste dans le traitement des décaissements, le rapprochement de caisse, la déclaration de TVA et la validation des précommandes.',
    quickReplies: [
      { label: 'Décaissements validés', action: 'cpt_decaissements' },
      { label: 'Versements caisse', action: 'cpt_versements' },
      { label: 'Valider précommandes', action: 'cpt_commandes' },
      { label: 'Journal des écritures', action: 'cpt_journal' }
    ],
    whatsappRoute: '/comptable/commandes'
  },
  COMMERCIAL: {
    code: 'COMMERCIAL',
    titre: 'TantyBot Commercial',
    badge: 'Force de Vente Terrain',
    intro: 'Bonjour ! Je vous aide à optimiser les tournées de livraison, saisir les commandes WhatsApp rapides, suivre les plafonds de crédit et vos primes.',
    quickReplies: [
      { label: '+ Commande WhatsApp', action: 'com_nouvelle' },
      { label: 'Ventes du jour', action: 'com_ventes' },
      { label: 'Créances clients', action: 'com_creances' },
      { label: 'Primes hebdomadaires', action: 'com_primes' }
    ],
    whatsappRoute: '/commercial/commandes-clients'
  },
  STOCK: {
    code: 'STOCK',
    titre: 'TantyBot Stock & Logistique',
    badge: 'Magasins & Lots FEFO',
    intro: 'Bonjour ! Je supervise les niveaux de stock par entrepôt (Central, Buffer, Mobile), les alertes critiques, les lots approchant de la DLC et les inventaires.',
    quickReplies: [
      { label: 'Articles critiques', action: 'stock_critiques' },
      { label: 'Ajustement inventaire', action: 'stock_articles' },
      { label: 'Lots FEFO & DLC', action: 'stock_lots' },
      { label: 'Mouvements récents', action: 'stock_mouvements' }
    ],
    whatsappRoute: '/stock/commandes-clients'
  },
  PRODUCTION: {
    code: 'PRODUCTION',
    titre: 'TantyBot Production Industrielle',
    badge: 'Lignes & Formulations',
    intro: 'Bonjour ! Je suis calibré pour le suivi des ordres de fabrication (OF), le respect des formulations de dosage, les rendements et les matières premières.',
    quickReplies: [
      { label: 'Ordres en cours (OF)', action: 'prod_of' },
      { label: 'Formulations recettes', action: 'prod_formules' },
      { label: 'Rendement lignes', action: 'prod_rendement' },
      { label: 'Consommations MP', action: 'prod_mp' }
    ],
    whatsappRoute: '/production/commandes-clients'
  },
  SECRETAIRE: {
    code: 'SECRETAIRE',
    titre: 'TantyBot Secrétariat',
    badge: 'Accueil & Précommandes',
    intro: 'Bonjour ! Je vous assiste dans la centralisation des précommandes J+1, la distribution des bons de décaissement validés et la gestion des visiteurs.',
    quickReplies: [
      { label: 'Précommandes clients', action: 'sec_precommandes' },
      { label: 'Bons à décaisser', action: 'sec_decaissements' },
      { label: 'Nouveau visiteur', action: 'sec_visiteurs' },
      { label: 'Gestion courriers', action: 'sec_courriers' }
    ],
    whatsappRoute: '/secretaire/commandes-clients'
  },
  CONTROLE: {
    code: 'CONTROLE',
    titre: 'TantyBot Contrôle de Gestion',
    badge: 'Audit & Budgets',
    intro: 'Bonjour ! Je vous assiste dans le visa préalable des décaissements, le contrôle des écarts d\'inventaire et l\'analyse de la rentabilité par tournée.',
    quickReplies: [
      { label: 'Viser décaissements', action: 'ctrl_decaissements' },
      { label: 'Alertes budget', action: 'ctrl_budget' },
      { label: 'Audit inventaires', action: 'ctrl_inventaires' },
      { label: 'Tableau de bord', action: 'ctrl_dashboard' }
    ],
    whatsappRoute: '/controle/commandes-clients'
  }
};

@Component({
  selector: 'app-tantybot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tantybot.component.html',
  styleUrls: ['./tantybot.component.css']
})
export class TantybotComponent implements OnInit, AfterViewChecked {
  @ViewChild('msgScroll') msgScroll!: ElementRef<HTMLDivElement>;

  isOpen = signal(false);
  isTyping = signal(false);
  messages = signal<BotMessage[]>([]);
  input = signal('');
  unreadBadge = signal(0);

  private api = inject(ApiService);
  private router = inject(Router);
  private iaService = inject(IaService);
  private iaConfigured = signal(false);
  private conversationHistory: { role: string; content: string }[] = [];

  currentContext = signal<ModuleContextInfo>(MODULE_CONTEXTS['STOCK']);

  ngOnInit(): void {
    this.detectModuleContext(this.router.url);

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.detectModuleContext(e.urlAfterRedirects || e.url);
    });

    this.iaService.getStatus().pipe(
      catchError(() => of({ configured: false, model: '', service: 'TantyAI' }))
    ).subscribe(s => this.iaConfigured.set(s.configured));
  }

  detectModuleContext(url: string): void {
    let key = 'STOCK';
    if (url.includes('/admin')) key = 'ADMIN';
    else if (url.includes('/dg')) key = 'DG';
    else if (url.includes('/rp')) key = 'RP';
    else if (url.includes('/comptable')) key = 'COMPTABLE';
    else if (url.includes('/commercial')) key = 'COMMERCIAL';
    else if (url.includes('/production')) key = 'PRODUCTION';
    else if (url.includes('/secretaire')) key = 'SECRETAIRE';
    else if (url.includes('/controle')) key = 'CONTROLE';
    else if (url.includes('/stock')) key = 'STOCK';

    const ctx = MODULE_CONTEXTS[key] || MODULE_CONTEXTS['STOCK'];
    const prevKey = this.currentContext().code;
    this.currentContext.set(ctx);

    if (prevKey !== key || this.messages().length === 0) {
      this.messages.set([{
        role: 'bot',
        content: ctx.intro,
        time: this.now(),
        quickReplies: ctx.quickReplies
      }]);
    }
  }

  ouvrirWhatsApp(): void {
    const route = this.currentContext().whatsappRoute;
    if (route) {
      this.router.navigate([route]);
    }
  }

  toggle(): void {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.unreadBadge.set(0);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  send(): void {
    const text = this.input().trim();
    if (!text) return;
    this.addMessage('user', text);
    this.input.set('');
    this.processQuery(text);
  }

  handleQuickReply(action: string): void {
    const ctx = this.currentContext();
    const navMap: Record<string, string> = {
      // Stock
      stock_articles: '/stock/articles',
      stock_critiques: '/stock/articles',
      stock_lots: '/stock/articles',
      stock_mouvements: '/stock/mouvements',
      // Admin
      admin_bloques: '/admin/utilisateurs',
      admin_audit: '/admin/audit',
      admin_sante: '/admin-systeme/suivi',
      admin_backup: '/admin-systeme/sauvegardes',
      // DG
      dg_synthese: '/dg/dashboard',
      dg_arbitrage: '/dg/arbitrage',
      dg_decaissements: '/dg/decaissements',
      dg_tournees: '/dg/commandes',
      // RP
      rp_grands_comptes: '/rp/grands-comptes',
      rp_primes: '/rp/primes',
      rp_documents: '/rp/documents',
      rp_stats: '/rp/statistiques',
      // Comptable
      cpt_decaissements: '/comptable/decaissements',
      cpt_versements: '/comptable/caisse',
      cpt_commandes: '/comptable/commandes',
      cpt_journal: '/comptable/caisse',
      // Commercial
      com_nouvelle: '/commercial/commandes-clients',
      com_ventes: '/commercial/ventes',
      com_creances: '/commercial/creances',
      com_primes: '/commercial/primes',
      // Production
      prod_of: '/production/ordres',
      prod_formules: '/production/formulation',
      prod_rendement: '/production/dashboard',
      prod_mp: '/production/matieres',
      // Secrétaire
      sec_precommandes: '/secretaire/commandes',
      sec_decaissements: '/secretaire/validation',
      sec_visiteurs: '/secretaire/visiteurs',
      sec_courriers: '/secretaire/courriers',
      // Contrôle
      ctrl_decaissements: '/controle/decaissements',
      ctrl_budget: '/controle/budget',
      ctrl_inventaires: '/controle/inventaire',
      ctrl_dashboard: '/controle/dashboard'
    };

    const targetRoute = navMap[action];
    if (targetRoute) {
      this.router.navigate([targetRoute]);
      this.isOpen.set(false);
    } else {
      this.processQuery(action);
    }
  }

  private processQuery(query: string): void {
    this.isTyping.set(true);
    const q = query.toLowerCase();

    const isGreeting = q.includes('bonjour') || q.includes('salut') || q.includes('hello');
    const isHelp = q.includes('aide') || q.includes('help') || q.includes('options');

    if (isGreeting || isHelp) {
      setTimeout(() => {
        this.isTyping.set(false);
        const ctx = this.currentContext();
        if (isGreeting) {
          this.reply(`Bonjour ! Je suis ${ctx.titre} (${ctx.badge}). Que souhaitez-vous vérifier ?`, ctx.quickReplies);
        } else {
          this.reply(`Voici les raccourcis configurés pour votre module actuel (${ctx.badge}) :`, ctx.quickReplies);
        }
      }, 350);
      return;
    }

    if (q.includes('stock') || q.includes('rupture') || q.includes('critique')) {
      this.fetchStockSummary();
    } else if (q.includes('alerte')) {
      this.fetchAlertSummary();
    } else {
      this.queryIa(query);
    }
  }

  private queryIa(query: string): void {
    this.isTyping.set(true);
    this.conversationHistory.push({ role: 'user', content: query });

    const ctx = this.currentContext();
    const contextualPrompt = `[Contexte ERP: ${ctx.code} - ${ctx.badge}] ${query}`;

    this.iaService.chat({
      message: contextualPrompt,
      conversationHistory: this.conversationHistory.slice(-8)
    }).pipe(
      catchError(() => of({
        reply: `Désolé, l'agent IA TantyBot n'a pas pu traiter cette demande textuelle pour le moment. Vous pouvez naviguer directement via les raccourcis du module ${ctx.badge} ci-dessous.`,
        model: 'fallback',
        usingFallback: true
      }))
    ).subscribe(resp => {
      this.isTyping.set(false);
      this.conversationHistory.push({ role: 'assistant', content: resp.reply });
      this.reply(resp.reply, ctx.quickReplies);
    });
  }

  private fetchStockSummary(): void {
    this.isTyping.set(true);
    this.api.get<any>('v1/stock/dashboard/stats').subscribe({
      next: (data: any) => {
        this.isTyping.set(false);
        const totalProducts = data?.totalProducts ?? '-';
        const totalValue = data?.totalStockValue ?? 0;
        const lowStock = data?.lowStockCount ?? 0;
        const msg = `📊 État du stock :\n• Références : ${totalProducts}\n• Valeur totale : ${this.formatCFA(totalValue)}\n• Alertes stock bas : ${lowStock}`;
        this.reply(msg, this.currentContext().quickReplies);
      },
      error: () => {
        this.isTyping.set(false);
        this.reply('Les données de stock sont actuellement synchronisées avec l\'entrepôt central.');
      }
    });
  }

  private fetchAlertSummary(): void {
    this.isTyping.set(true);
    this.api.get<any[]>('stock/alerts/active/priority').subscribe({
      next: (alerts: any[]) => {
        this.isTyping.set(false);
        const active = alerts.filter((a: any) => a.status === 'ACTIVE');
        const critical = active.filter((a: any) => a.priority === 'CRITICAL');
        const msg = `⚠️ Synthèse des Alertes :\n• Total enregistrées : ${alerts.length}\n• Alertes actives : ${active.length}\n• Niveau critique : ${critical.length}`;
        this.reply(msg, this.currentContext().quickReplies);
      },
      error: () => {
        this.isTyping.set(false);
        this.reply('Aucune alerte bloquante signalée.');
      }
    });
  }

  private reply(content: string, quickReplies?: { label: string; action: string }[]): void {
    this.addMessage('bot', content, quickReplies);
    if (!this.isOpen()) {
      this.unreadBadge.update(v => v + 1);
    }
  }

  private addMessage(role: 'user' | 'bot', content: string, quickReplies?: { label: string; action: string }[]): void {
    this.messages.update(list => [...list, { role, content, time: this.now(), quickReplies }]);
    setTimeout(() => this.scrollToBottom(), 50);
  }

  private scrollToBottom(): void {
    if (this.msgScroll?.nativeElement) {
      this.msgScroll.nativeElement.scrollTop = this.msgScroll.nativeElement.scrollHeight;
    }
  }

  ngAfterViewChecked(): void {
    if (this.isOpen()) this.scrollToBottom();
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private now(): string {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  private formatCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }
}
