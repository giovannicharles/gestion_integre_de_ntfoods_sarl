import { Component, OnInit, signal, inject, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { CommercialUseCase } from '../../../application/use-cases/commercial/commercial.use-case';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { Commercial, InfoProduits, StockLevel } from '../../../domain/models/stock.models';
Chart.register(...registerables);

@Component({ selector:'app-commercial', standalone:true, imports:[CommonModule,DecimalPipe,FormsModule], templateUrl:'./commercial.component.html', styleUrls:['./commercial.component.css'] })
export class CommercialComponent implements OnInit, AfterViewInit, OnDestroy {
  private d$=new Subject<void>(); private uc=inject(CommercialUseCase); private repo=inject(StockMockRepository); private cdr=inject(ChangeDetectorRef);
  @ViewChild('salesCanvas') salesCanvas!:ElementRef<HTMLCanvasElement>;
  @ViewChild('perfCanvas')  perfCanvas!:ElementRef<HTMLCanvasElement>;
  private charts:Chart[]=[];
  today=new Date();
  loading=signal(true); commercials=signal<Commercial[]>([]); infos=signal<InfoProduits[]>([]); pfLevels=signal<StockLevel[]>([]);
  showDotation=signal(false); dotationComm=0; dotationLines:Array<{productId:number;qty:number}>=[];
  dotationSaving=signal(false); toastMsg=signal(''); toastType=signal<'success'|'error'>('success');
  ngOnInit(){forkJoin({c:this.uc.getCommercials(),i:this.uc.getInfoProduits(),l:this.repo.getStockLevels()}).pipe(takeUntil(this.d$)).subscribe({next:({c,i,l})=>{this.commercials.set(c);this.infos.set(i);this.pfLevels.set(l.filter(sl=>sl.warehouseId===3));this.loading.set(false);this.cdr.detectChanges();setTimeout(()=>this.buildCharts(),120);},error:()=>this.loading.set(false)});}
  ngAfterViewInit(){if(!this.loading())this.buildCharts();}
  buildCharts(){this.charts.forEach(c=>c.destroy());this.charts=[];if(this.salesCanvas)this.buildSalesChart();if(this.perfCanvas)this.buildPerfChart();}
  private buildSalesChart(){const ctx=this.salesCanvas.nativeElement.getContext('2d')!;const comms=this.commercials();const ip=(id:number)=>this.infos().find(x=>x.commercialId===id);this.charts.push(new Chart(ctx,{type:'bar',data:{labels:comms.map(c=>c.name.split(' ')[0]),datasets:[{label:'Pris',data:comms.map(c=>ip(c.id)?this.getPrise(ip(c.id)!):0),backgroundColor:'rgba(26,107,42,.5)',borderRadius:4},{label:'Vendus',data:comms.map(c=>ip(c.id)?this.getVendu(ip(c.id)!):0),backgroundColor:'rgba(26,107,42,1)',borderRadius:4},{label:'Restants',data:comms.map(c=>ip(c.id)?this.getRestant(ip(c.id)!):0),backgroundColor:'rgba(230,81,0,.7)',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{family:'DM Sans',size:11},usePointStyle:true}}},scales:{x:{grid:{display:false},ticks:{font:{family:'DM Sans',size:11}}},y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{family:'DM Sans',size:10}}}}}}));}
  private buildPerfChart(){const ctx=this.perfCanvas.nativeElement.getContext('2d')!;const rates=this.commercials().map(c=>{const ip=this.infos().find(x=>x.commercialId===c.id);return ip?this.getTaux(ip):0;});this.charts.push(new Chart(ctx,{type:'doughnut',data:{labels:this.commercials().map(c=>c.name.split(' ')[0]),datasets:[{data:rates,backgroundColor:['rgba(26,107,42,.85)','rgba(2,119,189,.85)','rgba(200,168,0,.85)'],borderWidth:3,borderColor:'#fff',hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{family:'DM Sans',size:11},padding:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed}% taux de vente`}}}}}));}
  getInfoForComm(id:number){return this.infos().find(ip=>ip.commercialId===id);}
  getPrise(ip:InfoProduits){return ip.lines.reduce((a,l)=>a+l.takenQty,0);}
  getVendu(ip:InfoProduits){return ip.lines.reduce((a,l)=>a+l.soldQty,0);}
  getRestant(ip:InfoProduits){return ip.lines.reduce((a,l)=>a+l.returnedQty,0);}
  getTaux(ip:InfoProduits){const p=this.getPrise(ip);return p>0?Math.round((this.getVendu(ip)/p)*100):0;}
  getMontant(ip:InfoProduits){return ip.montantTotal||ip.lines.reduce((a,l)=>a+(l.soldQty*(l.unitPrice||0)),0);}
  getTotalVentes(){return this.infos().reduce((a,ip)=>a+this.getMontant(ip),0);}
  getTotalVendus(){return this.infos().reduce((a,ip)=>a+this.getVendu(ip),0);}
  getTauxGlobal(){const tp=this.infos().reduce((a,ip)=>a+this.getPrise(ip),0);return tp>0?Math.round((this.getTotalVendus()/tp)*100):0;}
  getStatusClass(s:string){const m:Record<string,string>={DRAFT:'badge-warning',PENDING_CASH:'badge-info',PENDING_ACCOUNTANT:'badge-secondary',CLOSED:'badge-success'};return m[s]||'badge-neutral';}
  getStatusLabel(s:string){const m:Record<string,string>={DRAFT:'Préparé',PENDING_CASH:'Att. caissière',PENDING_ACCOUNTANT:'Att. comptable',CLOSED:'Clôturé'};return m[s]||s;}
  openDotation(c:Commercial){this.dotationComm=c.id;this.dotationLines=this.pfLevels().map(sl=>({productId:sl.productId,qty:0}));this.showDotation.set(true);}
  closeDotation(){this.showDotation.set(false);}
  getDotTotal(){return this.dotationLines.reduce((a,l)=>{const sl=this.pfLevels().find(s=>s.productId===l.productId);return a+l.qty*(sl?.unitPrice||0);},0);}
  submitDotation(){this.dotationSaving.set(true);setTimeout(()=>{this.dotationSaving.set(false);this.closeDotation();this.showToast('Dotation créée. Le commercial peut récupérer ses produits.','success');},800);}
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  showToast(msg:string,type:'success'|'error'){this.toastMsg.set(msg);this.toastType.set(type);setTimeout(()=>this.toastMsg.set(''),4500);}
  ngOnDestroy(){this.charts.forEach(c=>c.destroy());this.d$.next();this.d$.complete();}
}
