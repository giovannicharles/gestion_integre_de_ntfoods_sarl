import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { StockLevelUseCase } from '../../../application/use-cases/inventaire/stock-level.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockMovement, StockLevel } from '../../../domain/models';
import { AuthService } from '../../../../../core/auth/auth.service';
Chart.register(...registerables);

@Component({ selector:'app-mouvements', standalone:true, imports:[CommonModule,DatePipe,DecimalPipe,FormsModule], templateUrl:'./mouvements.component.html', styleUrls:['./mouvements.component.css'] })
export class MouvementsComponent implements OnInit, OnDestroy {
  private d$=new Subject<void>(); private uc=inject(StockLevelUseCase); private repo=inject(StockApiRepository); private auth=inject(AuthService);
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
  isEntree(t:string){return t.startsWith('RECEPTION')||t==='TRANSFER_MOBILE_TO_CENTRAL';}
  getIcon(t:string){const m:Record<string,string>={RECEPTION_PRODUCTION:'fa-industry',RECEPTION_CONSOMMABLE:'fa-arrow-circle-down',RECEPTION_RAW_MATERIAL:'fa-arrow-circle-down',RECEPTION_MATERIEL:'fa-arrow-circle-down',TRANSFER_CENTRAL_TO_BUFFER:'fa-boxes-stacked',TRANSFER_BUFFER_TO_MOBILE:'fa-truck',TRANSFER_MOBILE_TO_CENTRAL:'fa-arrow-rotate-left',SALE:'fa-cash-register',ADJUSTMENT:'fa-sliders',LOSS:'fa-triangle-exclamation',EXPIRATION:'fa-calendar-xmark'};return m[t]||'fa-circle';}
  getColor(t:string){const m:Record<string,string>={RECEPTION_PRODUCTION:'mc-t',RECEPTION_CONSOMMABLE:'mc-g',RECEPTION_RAW_MATERIAL:'mc-g',RECEPTION_MATERIEL:'mc-g',TRANSFER_CENTRAL_TO_BUFFER:'mc-t',TRANSFER_BUFFER_TO_MOBILE:'mc-b',TRANSFER_MOBILE_TO_CENTRAL:'mc-g',SALE:'mc-b',ADJUSTMENT:'mc-n',LOSS:'mc-r',EXPIRATION:'mc-r'};return m[t]||'mc-n';}
  getLabel(t:string){const m:Record<string,string>={RECEPTION_PRODUCTION:'Entrée production',RECEPTION_CONSOMMABLE:'Réception consommable',RECEPTION_RAW_MATERIAL:'Réception MP',RECEPTION_MATERIEL:'Réception matériel',TRANSFER_CENTRAL_TO_BUFFER:'Transfert central→tampon',TRANSFER_BUFFER_TO_MOBILE:'Dotation (tampon→mobile)',TRANSFER_MOBILE_TO_CENTRAL:'Retour mobile→central',SALE:'Vente',ADJUSTMENT:'Ajustement inventaire',LOSS:'Perte/Casse',EXPIRATION:'Expiration'};return m[t]||t;}
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  getAjustSL(){return this.levels().find(sl=>sl.id===this.ajustId);}
  getTransfertSL(){return this.levels().filter(sl=>sl.warehouseId===1).find(sl=>sl.id===this.transfertId)||this.levels().filter(sl=>sl.warehouseId===1)[0];}
  getMPLevels(){return this.levels().filter(sl=>sl.warehouseId===1);}
  sauverAjust(){if(!this.ajustId||!this.ajustMotif||this.ajustSaving())return;this.ajustSaving.set(true);this.uc.adjust(this.ajustId,this.ajustQty,this.ajustMotif).pipe(takeUntil(this.d$)).subscribe({next:()=>{this.ajustSaving.set(false);this.showAjust.set(false);this.showToast('Ajustement enregistré.','success');forkJoin({m:this.uc.getMovements(),l:this.uc.getAll()}).pipe(takeUntil(this.d$)).subscribe(({m,l})=>{this.all.set(m);this.levels.set(l);this.applyFilters();});},error:()=>this.ajustSaving.set(false)});}
  sauverTransfert(){
    if(!this.transfertId||this.transfertQty<=0||this.transfertSaving())return;
    this.transfertSaving.set(true);
    const sl=this.levels().find(x=>x.id===this.transfertId);
    if(!sl){this.transfertSaving.set(false);return;}
    const userId=this.auth.getCurrentUser()?.matricule||'system';
    this.repo.replenishBuffer(sl.productSku||'',this.transfertQty,userId,`Transfert vers tampon - ${sl.productName}`).pipe(takeUntil(this.d$)).subscribe({
      next:()=>{this.transfertSaving.set(false);this.showTransfert.set(false);this.showToast('Transfert vers tampon effectué.','success');forkJoin({m:this.uc.getMovements(),l:this.uc.getAll()}).pipe(takeUntil(this.d$)).subscribe(({m,l})=>{this.all.set(m);this.levels.set(l);this.applyFilters();});},
      error:(err)=>{this.transfertSaving.set(false);const msg=err?.error?.message||'Erreur lors du transfert';this.showToast(msg,'error');}
    });
  }
  showToast(msg:string,type:'success'|'error'){this.toastMsg.set(msg);this.toastType.set(type);setTimeout(()=>this.toastMsg.set(''),4000);}
  ngOnDestroy(){this.d$.next();this.d$.complete();}
}
