import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { StockLevelUseCase } from '../../../application/use-cases/inventaire/stock-level.use-case';
import { StockLevel } from '../../../domain/models/stock.models';
@Component({ selector:'app-alertes', standalone:true, imports:[CommonModule,DecimalPipe,RouterLink], template:`
<div class="page animate-fadeInUp">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:22px">
    <div style="display:flex;align-items:center;gap:13px"><div style="width:46px;height:46px;background:var(--r-gh);color:var(--r);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;font-size:19px"><i class="fa-solid fa-triangle-exclamation"></i></div><div><h1 style="font-family:var(--font-d);font-size:20px;font-weight:800;color:var(--n900)">Alertes de Stock</h1><p style="font-size:12px;color:var(--n400);margin-top:2px">Produits sous le seuil de réapprovisionnement</p></div></div>
    <div style="display:flex;gap:6px">
      <button class="tab-btn" [class.tb-active]="filter()==='TOUS'" (click)="filter.set('TOUS')">Tous <span>{{ alerts().length }}</span></button>
      <button class="tab-btn tb-red" [class.tb-active]="filter()==='CRITIQUE'" (click)="filter.set('CRITIQUE')">🔴 Critiques <span>{{ critiques().length }}</span></button>
      <button class="tab-btn tb-o" [class.tb-active]="filter()==='FAIBLE'" (click)="filter.set('FAIBLE')">🟠 Faibles <span>{{ faibles().length }}</span></button>
    </div>
  </div>
  @if (loading()) { <div style="padding:60px;text-align:center;color:var(--n400)"><div class="spinner spinner-lg" style="margin:0 auto 12px"></div>Chargement…</div> }
  @else if (getFiltered().length===0) {
    <div class="card"><div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:64px;text-align:center"><i class="fa-solid fa-circle-check" style="font-size:52px;color:var(--g)"></i><h3 style="font-family:var(--font-d);font-size:20px;font-weight:700;color:var(--n800)">Tous les stocks sont sains !</h3><p style="font-size:13px;color:var(--n400)">Aucune alerte active.</p></div></div>
  } @else {
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px">
      @for (sl of getFiltered(); track sl.id) {
        <div class="al-card" [class.alc-crit]="sl.alertLevel==='CRITIQUE'" [class.alc-faib]="sl.alertLevel==='FAIBLE'">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="al-dot" [class.ald-r]="sl.alertLevel==='CRITIQUE'" [class.ald-o]="sl.alertLevel==='FAIBLE'">@if (sl.alertLevel==='CRITIQUE') { <span class="ring"></span> }</div>
              <div>
                <h4 style="font-family:var(--font-d);font-size:15px;font-weight:800;color:var(--n900)">{{ sl.productName }}</h4>
                <div style="font-size:10px;color:var(--n400);font-family:monospace">{{ sl.productSku }}</div>
              </div>
            </div>
            <span class="badge" [class.badge-danger]="sl.alertLevel==='CRITIQUE'" [class.badge-warning]="sl.alertLevel==='FAIBLE'">{{ sl.alertLevel }}</span>
          </div>
          <span class="badge badge-neutral" style="font-size:10px;align-self:flex-start">{{ sl.warehouseName }}</span>
          <div class="al-bar-wrap">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--n500);margin-bottom:5px"><span>Stock actuel</span><span style="font-weight:700;" [style.color]="sl.alertLevel==='CRITIQUE'?'var(--r)':'var(--o)'">{{ sl.quantity | number }} / {{ sl.reorderPoint | number }} {{ sl.productUnit }}</span></div>
            <div style="height:8px;background:var(--n150);border-radius:4px;overflow:hidden"><div [style.width.%]="Math.min(100,(sl.quantity/sl.reorderPoint)*100)" [style.background]="sl.alertLevel==='CRITIQUE'?'var(--r)':'var(--o)'" style="height:100%;border-radius:4px;transition:width 1s"></div></div>
          </div>
          @if ((sl.leadTimeDays||0)>=90) { <div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#00796B;background:#E0F2F1;padding:4px 10px;border-radius:var(--r-full)"><i class="fa-solid fa-ship"></i>Délai appro.: {{ sl.leadTimeDays }} jours</div> }
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px solid rgba(0,0,0,.06)">
            <span style="font-size:11px;color:var(--n500)">Valeur restante: <strong>{{ fCFA(sl.stockValue||0) }}</strong></span>
            <a routerLink="/stock/reception/new" class="btn btn-primary btn-sm"><i class="fa-solid fa-truck-ramp-box"></i> Commander</a>
          </div>
        </div>
      }
    </div>
  }
</div>
`, styles:[`.page{display:flex;flex-direction:column;gap:22px}.tab-btn{display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:var(--r-md);font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid var(--n200);background:transparent;color:var(--n500);transition:all .15s;font-family:var(--font-b)}.tab-btn span{background:var(--n200);color:var(--n600);font-size:10px;font-weight:800;padding:1px 6px;border-radius:var(--r-full)}.tab-btn.tb-active{background:var(--n200);color:var(--n800)}.tb-red.tb-active{background:var(--r-gh);color:var(--r);border-color:rgba(198,40,40,.3)}.tb-o.tb-active{background:var(--o-gh);color:var(--o);border-color:rgba(230,81,0,.3)}.al-card{background:white;border:1.5px solid var(--n200);border-radius:var(--r-lg);padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:var(--sh-sm);animation:cardIn .3s ease both}.alc-crit{border-left:4px solid var(--r)}.alc-faib{border-left:4px solid var(--o)}.al-dot{width:14px;height:14px;border-radius:50%;position:relative;flex-shrink:0}.ald-r{background:var(--r)}.ald-o{background:var(--o)}.ring{position:absolute;inset:-4px;border-radius:50%;border:2px solid var(--r);animation:ringOut 1.5s infinite}.al-bar-wrap{background:var(--n50);border-radius:var(--r-sm);padding:10px 12px}`] })
export class AlertesComponent implements OnInit, OnDestroy {
  private d$=new Subject<void>(); private uc=inject(StockLevelUseCase);
  loading=signal(true); alerts=signal<StockLevel[]>([]); filter=signal<'TOUS'|'CRITIQUE'|'FAIBLE'>('TOUS');
  Math=Math;
  critiques(){return this.alerts().filter(sl=>sl.alertLevel==='CRITIQUE');}
  faibles(){return this.alerts().filter(sl=>sl.alertLevel==='FAIBLE');}
  getFiltered(){const f=this.filter();return f==='TOUS'?this.alerts():this.alerts().filter(sl=>sl.alertLevel===f);}
  ngOnInit(){this.uc.getAlerts().pipe(takeUntil(this.d$)).subscribe({next:r=>{this.alerts.set(r);this.loading.set(false);},error:()=>this.loading.set(false)});}
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  ngOnDestroy(){this.d$.next();this.d$.complete();}
}
