import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ReceiptUseCase } from '../../../application/use-cases/reception/receipt.use-case';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';
import { Receipt } from '../../../domain/models/stock.models';

@Component({ selector:'app-validation', standalone:true, imports:[CommonModule,DatePipe,DecimalPipe,FormsModule,RouterLink], templateUrl:'./validation.component.html', styleUrls:['./validation.component.css'] })
export class ValidationComponent implements OnInit, OnDestroy {
  private d$=new Subject<void>();
  private uc=inject(ReceiptUseCase);
  private rules=inject(StockRulesDomainService);
  loading=signal(true); receipts=signal<Receipt[]>([]); selected=signal<Receipt|null>(null);
  action=signal<'v1'|'v2'|'rej'|null>(null); notes=''; rejectReason=''; processing=signal(false);
  currentRole=signal<'gestionnaire'|'chef'>('gestionnaire');
  toastMsg=signal(''); toastType=signal<'success'|'error'>('success');
  ngOnInit(){this.load();}
  load(){this.loading.set(true);this.uc.getPending().pipe(takeUntil(this.d$)).subscribe({next:r=>{this.receipts.set(r);this.loading.set(false);},error:()=>this.loading.set(false)});}
  openAction(r:Receipt,a:'v1'|'v2'|'rej'){this.selected.set(r);this.action.set(a);this.notes='';this.rejectReason='';}
  closeAction(){this.selected.set(null);this.action.set(null);}
  confirm(){
    const r=this.selected();const a=this.action();if(!r)return;
    this.processing.set(true);
    const obs$=a==='v1'?this.uc.validateFirst(r.id,this.notes):a==='v2'?this.uc.validateSecond(r.id,this.notes):this.uc.reject(r.id,this.rejectReason);
    obs$.pipe(takeUntil(this.d$)).subscribe({next:()=>{this.processing.set(false);this.closeAction();this.showToast(a==='rej'?'Réception rejetée.':a==='v1'?'1ère validation effectuée.':'Validation finale. Stock mis à jour.','success');this.load();},error:()=>{this.processing.set(false);this.showToast('Erreur.','error');}});
  }
  canV1(r:Receipt){return r.status==='PENDING_FIRST_VALIDATION';}
  canV2(r:Receipt){return r.status==='PENDING_SECOND_VALIDATION';}
  isMP(r:Receipt){return this.rules.requiresSecondValidation(r.warehouseName||'');}
  totalQty(r:Receipt){return r.items.reduce((a,i)=>a+i.receivedQty,0);}
  sLabel(s:string){const m:Record<string,string>={PENDING_FIRST_VALIDATION:'Att. 1ère val.',PENDING_SECOND_VALIDATION:'Att. 2ème val.'};return m[s]||s;}
  sClass(s:string){const m:Record<string,string>={PENDING_FIRST_VALIDATION:'badge-warning',PENDING_SECOND_VALIDATION:'badge-info'};return m[s]||'badge-neutral';}
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  showToast(msg:string,type:'success'|'error'){this.toastMsg.set(msg);this.toastType.set(type);setTimeout(()=>this.toastMsg.set(''),4500);}
  ngOnDestroy(){this.d$.next();this.d$.complete();}
}
