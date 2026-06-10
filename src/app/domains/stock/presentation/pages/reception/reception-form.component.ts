import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ReceiptUseCase } from '../../../application/use-cases/reception/receipt.use-case';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';
import { Supplier, Warehouse, StockLevel, Receipt, ReceiptItem } from '../../../domain/models/stock.models';

interface LineForm { id:string; slId:number; sl?:StockLevel; orderedQty:number; receivedQty:number; ecart:number; deviationReason:string; prixUnit:number; total:number; lot:string; }

@Component({ selector:'app-reception-form', standalone:true, imports:[CommonModule,FormsModule,RouterLink,DecimalPipe], templateUrl:'./reception-form.component.html', styleUrls:['./reception-form.component.css'] })
export class ReceptionFormComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  router=inject(Router);
  private uc=inject(ReceiptUseCase);
  private repo=inject(StockMockRepository);
  private rules=inject(StockRulesDomainService);
  loading=signal(true); saving=signal(false); success=signal(false);
  suppliers=signal<Supplier[]>([]); warehouses=signal<Warehouse[]>([]); levels=signal<StockLevel[]>([]);
  supplierId=0; warehouseId=1; bc=''; observations=''; source:'SUPPLIER'|'PRODUCTION'='SUPPLIER';
  lignes: LineForm[] = [];
  ngOnInit(){
    forkJoin({s:this.uc.getSuppliers(),w:this.uc.getWarehouses(),l:this.repo.getStockLevels()})
      .pipe(takeUntil(this.d$)).subscribe(({s,w,l})=>{this.suppliers.set(s);this.warehouses.set(w.filter(x=>!x.isBuffer));this.levels.set(l);this.warehouseId=w[0]?.id||1;this.loading.set(false);});
    this.addLine();
  }
  getFiltered(){return this.levels().filter(sl=>sl.warehouseId===this.warehouseId);}
  addLine(){this.lignes.push({id:'l'+Date.now(),slId:0,orderedQty:0,receivedQty:0,ecart:0,deviationReason:'',prixUnit:0,total:0,lot:''});}
  removeLine(i:number){if(this.lignes.length>1)this.lignes.splice(i,1);}
  onSLChange(l:LineForm){const sl=this.levels().find(x=>x.id===l.slId);l.sl=sl;if(sl){l.prixUnit=sl.unitPrice||0;this.recalc(l);}}
  onQteChange(l:LineForm){l.ecart=l.receivedQty-l.orderedQty;this.recalc(l);}
  recalc(l:LineForm){l.total=l.receivedQty*l.prixUnit;}
  getTotal(){return this.lignes.reduce((a,l)=>a+l.total,0);}
  isValid(){return this.supplierId>0&&this.lignes.some(l=>l.slId>0&&l.receivedQty>0)&&this.lignes.filter(l=>l.ecart!==0).every(l=>!!l.deviationReason);}
  getWName(){return this.warehouses().find(w=>w.id===this.warehouseId)?.name||'—';}
  getSupName(){return this.suppliers().find(s=>s.id===this.supplierId)?.name||'—';}
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  requiresSecond(){const w=this.warehouses().find(x=>x.id===this.warehouseId);return this.rules.requiresSecondValidation(w?.name||'');}
  sauvegarder(){
    if(!this.isValid()||this.saving())return;
    this.saving.set(true);
    const wh=this.warehouses().find(w=>w.id===this.warehouseId)!;
    const sup=this.suppliers().find(s=>s.id===this.supplierId)!;
    const items:ReceiptItem[]=this.lignes.filter(l=>l.slId>0&&l.receivedQty>0).map(l=>({id:Date.now(),productId:l.sl!.productId,productName:l.sl?.productName,productSku:l.sl?.productSku,productUnit:l.sl?.productUnit,orderedQty:l.orderedQty,receivedQty:l.receivedQty,deviation:l.ecart,deviationReason:l.deviationReason||undefined,lotNumber:l.lot||undefined,unitPrice:l.prixUnit,lineTotal:l.total}));
    this.uc.create({source:this.source,warehouse:wh,fournisseur:sup,warehouseId:wh.id,items,totalAmount:this.getTotal(),observationsGestionnaire:this.observations||undefined} as any)
      .pipe(takeUntil(this.d$)).subscribe({next:()=>{this.saving.set(false);this.success.set(true);setTimeout(()=>this.router.navigate(['/stock/reception']),2200);},error:()=>this.saving.set(false)});
  }
  ngOnDestroy(){this.d$.next();this.d$.complete();}
}
