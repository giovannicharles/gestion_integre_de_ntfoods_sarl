import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ReceiptUseCase } from '../../../application/use-cases/reception/receipt.use-case';
import { Receipt } from '../../../domain/models/stock.models';

@Component({ selector:'app-reception-list', standalone:true, imports:[CommonModule,RouterLink,DatePipe,FormsModule], template:`
<div class="page animate-fadeInUp">
  @if (toastMsg()) { <div class="toast animate-fadeInUp" [class.toast-success]="toastType()==='success'" [class.toast-error]="toastType()==='error'"><i class="fa-solid fa-circle-check"></i>{{ toastMsg() }}</div> }
  <div class="ph">
    <div class="ph-left">
      <div class="ph-icon"><i class="fa-solid fa-truck-ramp-box"></i></div>
      <div><h1 class="ph-title">Réceptions Fournisseurs</h1><p class="ph-sub">Historique des entrées marchandises — NTFoods TANTY</p></div>
    </div>
    <a routerLink="/stock/reception/new" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Nouvelle Réception</a>
  </div>
  <div class="stat-chips">
    <div class="s-chip sc-total"><i class="fa-solid fa-list"></i>{{ all().length }} total</div>
    <div class="s-chip sc-warn"><i class="fa-solid fa-hourglass-half"></i>{{ countStatus('PENDING_FIRST_VALIDATION') }} att. 1ère val.</div>
    <div class="s-chip sc-info"><i class="fa-solid fa-user-check"></i>{{ countStatus('PENDING_SECOND_VALIDATION') }} att. 2ème val.</div>
    <div class="s-chip sc-ok"><i class="fa-solid fa-check-double"></i>{{ countStatus('VALIDATED') }} validées</div>
    <div class="s-chip sc-danger"><i class="fa-solid fa-xmark"></i>{{ countStatus('REJECTED') }} rejetées</div>
  </div>
  <div class="card" style="overflow:hidden">
    @if (loading()) { <div style="padding:48px;text-align:center;color:var(--n400)"><div class="spinner spinner-lg" style="margin:0 auto 12px"></div>Chargement…</div> }
    @else {
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>N° Réception</th><th>Source</th><th>Entrepôt</th><th>Lignes</th><th>Montant</th><th>Date</th><th>Statut</th><th class="text-center">Actions</th></tr></thead>
        <tbody>
          @for (r of paginated(); track r.id) {
            <tr class="table-row-anim">
              <td><span style="font-family:var(--font-d);font-size:13px;font-weight:800;color:var(--g)">{{ r.receiptNumber }}</span></td>
              <td>
                @if (r.source==='SUPPLIER') { <span class="badge badge-secondary"><i class="fa-solid fa-truck"></i> {{ r.fournisseur?.name || 'Fournisseur' }}</span> }
                @else { <span class="badge badge-primary"><i class="fa-solid fa-industry"></i> Production</span> }
              </td>
              <td><span class="badge badge-neutral" style="font-size:10px">{{ r.warehouseName }}</span></td>
              <td><span style="font-family:var(--font-d);font-size:15px;font-weight:800">{{ r.items.length }}</span></td>
              <td><span style="font-size:12px;font-weight:700;color:var(--n700)">{{ fCFA(r.totalAmount) }}</span></td>
              <td><span style="font-size:11px;color:var(--n500)">{{ r.createdAt | date:'dd/MM/yyyy HH:mm' }}</span></td>
              <td><span class="badge {{ sClass(r.status) }}">{{ sLabel(r.status) }}</span></td>
              <td class="text-center">
                @if (r.status==='PENDING_FIRST_VALIDATION'||r.status==='PENDING_SECOND_VALIDATION') {
                  <a routerLink="/stock/validation" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:var(--g-gh);color:var(--g);text-decoration:none"><i class="fa-solid fa-check"></i></a>
                }
              </td>
            </tr>
          }
          @empty { <tr><td colspan="8" style="text-align:center;padding:48px;color:var(--n400)"><i class="fa-solid fa-inbox" style="font-size:32px;display:block;margin-bottom:8px"></i>Aucune réception</td></tr> }
        </tbody>
      </table>
    </div>
    @if (totalPages() > 1) {
      <div class="pagination-bar">
        <span class="pg-info">{{ (cp()-1)*ps+1 }}–{{ Math.min(cp()*ps, filtered().length) }} sur {{ filtered().length }}</span>
        <div class="pg-controls">
          <button class="pg-btn" [disabled]="cp()===1" (click)="goTo(cp()-1)"><i class="fa-solid fa-angle-left"></i></button>
          @for (p of pages; track p) { <button class="pg-btn" [class.pg-active]="p===cp()" (click)="goTo(p)">{{ p }}</button> }
          <button class="pg-btn" [disabled]="cp()===totalPages()" (click)="goTo(cp()+1)"><i class="fa-solid fa-angle-right"></i></button>
        </div>
      </div>
    }
    }
  </div>
</div>
`, styles:[`.page{display:flex;flex-direction:column;gap:22px}.ph{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.ph-left{display:flex;align-items:center;gap:13px}.ph-icon{width:46px;height:46px;background:var(--g-gh);color:var(--g);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;font-size:19px}.ph-title{font-family:var(--font-d);font-size:20px;font-weight:800;color:var(--n900)}.ph-sub{font-size:12px;color:var(--n400);margin-top:2px}.stat-chips{display:flex;gap:8px;flex-wrap:wrap}.s-chip{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--r-full);font-size:12px;font-weight:600;border:1.5px solid transparent}.sc-total{background:var(--n100);color:var(--n600);border-color:var(--n200)}.sc-warn{background:var(--o-gh);color:var(--o);border-color:rgba(230,81,0,.2)}.sc-info{background:var(--b-gh);color:var(--b);border-color:rgba(2,119,189,.2)}.sc-ok{background:var(--s-gh);color:var(--s);border-color:rgba(46,125,50,.2)}.sc-danger{background:var(--r-gh);color:var(--r);border-color:rgba(198,40,40,.2)}`]
})
export class ReceptionListComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private uc = inject(ReceiptUseCase);
  loading=signal(true); all=signal<Receipt[]>([]); filtered=signal<Receipt[]>([]); paginated=signal<Receipt[]>([]);
  ps=8; cp=signal(1); totalPages=signal(1);
  toastMsg=signal(''); toastType=signal<'success'|'error'>('success');
  Math=Math;
  get pages(){return Array.from({length:this.totalPages()},(_,i)=>i+1);}
  ngOnInit(){this.uc.getAll().pipe(takeUntil(this.d$)).subscribe({next:r=>{this.all.set(r);this.filtered.set(r);this.updatePag();this.loading.set(false);},error:()=>this.loading.set(false)});}
  updatePag(){const t=Math.ceil(this.filtered().length/this.ps)||1;this.totalPages.set(t);this.goTo(1);}
  goTo(p:number){const n=Math.max(1,Math.min(p,this.totalPages()));this.cp.set(n);const s=(n-1)*this.ps;this.paginated.set(this.filtered().slice(s,s+this.ps));}
  countStatus(s:string){return this.all().filter(r=>r.status===s).length;}
  sLabel(s:string){const m:Record<string,string>={PENDING_FIRST_VALIDATION:'Att. val. 1',PENDING_SECOND_VALIDATION:'Att. val. 2',VALIDATED:'Validé',REJECTED:'Rejeté'};return m[s]||s;}
  sClass(s:string){const m:Record<string,string>={PENDING_FIRST_VALIDATION:'badge-warning',PENDING_SECOND_VALIDATION:'badge-info',VALIDATED:'badge-success',REJECTED:'badge-danger'};return m[s]||'badge-neutral';}
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  showToast(msg:string,type:'success'|'error'){this.toastMsg.set(msg);this.toastType.set(type);setTimeout(()=>this.toastMsg.set(''),4000);}
  ngOnDestroy(){this.d$.next();this.d$.complete();}
}
