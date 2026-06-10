import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { StockLevelUseCase } from '../../../application/use-cases/inventaire/stock-level.use-case';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockMovement, StockLevel } from '../../../domain/models/stock.models';
Chart.register(...registerables);

@Component({ selector:'app-mouvements', standalone:true, imports:[CommonModule,DatePipe,DecimalPipe,FormsModule], templateUrl:'./mouvements.component.html', styleUrls:['./mouvements.component.css'] })
export class MouvementsComponent implements OnInit, OnDestroy {
  private d$=new Subject<void>(); private uc=inject(StockLevelUseCase); private repo=inject(StockMockRepository);
  loading=signal(true); all=signal<StockMovement[]>([]); filtered=signal<StockMovement[]>([]); paginated=signal<StockMovement[]>([]);
  levels=signal<StockLevel[]>([]); search=''; filterType=''; filterProd='';
  ps=12; cp=signal(1); totalPages=signal(1);
  showAjust=signal(false); showTransfert=signal(false);
  ajustId=0; ajustQty=0; ajustMotif=''; ajustSaving=signal(false);
  transfertId=0; transfertQty=0; transfertSaving=signal(false);
  Math=Math;
  toastMsg=signal(''); toastType=signal<'success'|'error'>('success');
  get pages(){return Array.from({length:this.totalPages()},(_,i)=>i+1);}
  ngOnInit(){forkJoin({m:this.uc.getMovements(),l:this.uc.getAll()}).pipe(takeUntil(this.d$)).subscribe({next:({m,l})=>{this.all.set(m);this.levels.set(l);this.applyFilters();this.loading.set(false);},error:()=>this.loading.set(false)});}
  applyFilters(){let r=this.all();if(this.search){const q=this.search.toLowerCase();r=r.filter(m=>(m.product?.designation||m.product?.sku||'').toLowerCase().includes(q)||(m.reference||'').toLowerCase().includes(q));}if(this.filterType)r=r.filter(m=>m.type===this.filterType);if(this.filterProd)r=r.filter(m=>m.productId===+this.filterProd);this.filtered.set(r);const t=Math.ceil(r.length/this.ps)||1;this.totalPages.set(t);this.goTo(1);}
  goTo(p:number){const n=Math.max(1,Math.min(p,this.totalPages()));this.cp.set(n);const s=(n-1)*this.ps;this.paginated.set(this.filtered().slice(s,s+this.ps));}
  count(t:string){return this.all().filter(m=>m.type===t).length;}
  isEntree(t:string){return t==='ENTRY_FROM_SUPPLIER'||t==='ENTRY_FROM_PRODUCTION';}
  getIcon(t:string){const m:Record<string,string>={ENTRY_FROM_SUPPLIER:'fa-arrow-circle-down',ENTRY_FROM_PRODUCTION:'fa-industry',EXIT_TO_COMMERCIAL:'fa-truck',TRANSFER:'fa-boxes-stacked',ADJUSTMENT:'fa-sliders',VIREMENT_BETWEEN_COMMERCIAL:'fa-right-left'};return m[t]||'fa-circle';}
  getColor(t:string){const m:Record<string,string>={ENTRY_FROM_SUPPLIER:'mc-g',ENTRY_FROM_PRODUCTION:'mc-t',EXIT_TO_COMMERCIAL:'mc-b',TRANSFER:'mc-t',ADJUSTMENT:'mc-n',VIREMENT_BETWEEN_COMMERCIAL:'mc-p'};return m[t]||'mc-n';}
  getLabel(t:string){const m:Record<string,string>={ENTRY_FROM_SUPPLIER:'Entrée fournisseur',ENTRY_FROM_PRODUCTION:'Entrée production',EXIT_TO_COMMERCIAL:'Sortie commercial',TRANSFER:'Transfert tampon',ADJUSTMENT:'Ajustement inventaire',VIREMENT_BETWEEN_COMMERCIAL:'Virement inter-comm.'};return m[t]||t;}
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  getAjustSL(){return this.levels().find(sl=>sl.id===this.ajustId);}
  getTransfertSL(){return this.levels().filter(sl=>sl.warehouseId===1).find(sl=>sl.id===this.transfertId)||this.levels().filter(sl=>sl.warehouseId===1)[0];}
  getMPLevels(){return this.levels().filter(sl=>sl.warehouseId===1);}
  sauverAjust(){if(!this.ajustId||!this.ajustMotif||this.ajustSaving())return;this.ajustSaving.set(true);this.uc.adjust(this.ajustId,this.ajustQty,this.ajustMotif).pipe(takeUntil(this.d$)).subscribe({next:()=>{this.ajustSaving.set(false);this.showAjust.set(false);this.showToast('Ajustement enregistré.','success');forkJoin({m:this.uc.getMovements(),l:this.uc.getAll()}).pipe(takeUntil(this.d$)).subscribe(({m,l})=>{this.all.set(m);this.levels.set(l);this.applyFilters();});},error:()=>this.ajustSaving.set(false)});}
  sauverTransfert(){if(!this.transfertId||this.transfertQty<=0||this.transfertSaving())return;this.transfertSaving.set(true);const sl=this.levels().find(x=>x.id===this.transfertId);if(sl){this.uc.adjust(this.transfertId,sl.quantity-this.transfertQty,'Transfert vers magasin tampon production').pipe(takeUntil(this.d$)).subscribe({next:()=>{this.transfertSaving.set(false);this.showTransfert.set(false);this.showToast('Transfert vers tampon effectué.','success');forkJoin({m:this.uc.getMovements(),l:this.uc.getAll()}).pipe(takeUntil(this.d$)).subscribe(({m,l})=>{this.all.set(m);this.levels.set(l);this.applyFilters();});},error:()=>this.transfertSaving.set(false)});}else this.transfertSaving.set(false);}
  showToast(msg:string,type:'success'|'error'){this.toastMsg.set(msg);this.toastType.set(type);setTimeout(()=>this.toastMsg.set(''),4000);}
  ngOnDestroy(){this.d$.next();this.d$.complete();}
}
