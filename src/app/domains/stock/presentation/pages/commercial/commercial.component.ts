import { Component, OnInit, signal, inject, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subject, forkJoin, takeUntil, combineLatest } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { CommercialUseCase } from '../../../application/use-cases/commercial/commercial.use-case';
import { DotationUseCase } from '../../../application/use-cases/dotation/dotation.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { AuthService } from '../../../../../core/auth/auth.service';
import { Commercial, InfoProduits, InfoProduitsLine, StockLevel, UnitType, CreateDotationRequest, DotationItem, DotationRequest } from '../../../domain/models';
Chart.register(...registerables);

@Component({ selector:'app-commercial', standalone:true, imports:[CommonModule,DecimalPipe,FormsModule,RouterLink], templateUrl:'./commercial.component.html', styleUrls:['./commercial.component.css'] })
export class CommercialComponent implements OnInit, AfterViewInit, OnDestroy {
  private d$=new Subject<void>();
  private uc=inject(CommercialUseCase);
  private dotationUC=inject(DotationUseCase);
  private repo=inject(StockApiRepository);
  private auth=inject(AuthService);
  private cdr=inject(ChangeDetectorRef);
  private router=inject(Router);
  private route=inject(ActivatedRoute);
  @ViewChild('salesCanvas') salesCanvas!:ElementRef<HTMLCanvasElement>;
  @ViewChild('perfCanvas')  perfCanvas!:ElementRef<HTMLCanvasElement>;
  private charts:Chart[]=[];
  today=new Date();
  loading=signal(true); commercials=signal<Commercial[]>([]); infos=signal<InfoProduits[]>([]); pfLevels=signal<StockLevel[]>([]);
  showDotation=signal(false); selectedComm=signal<Commercial | null>(null);
  dotationLines:Array<{productId:number;productName:string;productSku:string;qty:number;unitType:UnitType;unitsPerPack:number}>=[];
  dotationSaving=signal(false); toastMsg=signal(''); toastType=signal<'success'|'error'>('success');
  activeTab=signal<'dashboard'|'info'|'dotations'>('dashboard');
  search=signal('');
  detailComm=signal<Commercial | null>(null);
  dotationHistory=signal<DotationRequest[]>([]);
  detailLoading=signal(false);
  allDotations=signal<DotationRequest[]>([]);
  private commercials$ = toObservable(this.commercials);
  ngOnInit(){this.loadAll();this.handleQueryParams();}
  loadAll(){this.loading.set(true);forkJoin({c:this.uc.getCommercials(),i:this.uc.getInfoProduits(),l:this.repo.getStockLevels()}).pipe(takeUntil(this.d$)).subscribe({next:({c,i,l})=>{this.commercials.set(c);this.infos.set(i);this.pfLevels.set(l.filter(sl=>sl.warehouseId===3||sl.warehouseType==='BUFFER'));this.loading.set(false);this.cdr.detectChanges();setTimeout(()=>this.buildCharts(),120);},error:()=>this.loading.set(false)});}
  ngAfterViewInit(){if(!this.loading())this.buildCharts();}
  buildCharts(){this.charts.forEach(c=>c.destroy());this.charts=[];if(this.salesCanvas)this.buildSalesChart();if(this.perfCanvas)this.buildPerfChart();}
  private buildSalesChart(){const ctx=this.salesCanvas.nativeElement.getContext('2d')!;const comms=this.commercials();const ip=(mat?:string)=>this.infos().find(x=>x.commercialId===mat);this.charts.push(new Chart(ctx,{type:'bar',data:{labels:comms.map(c=>c.name.split(' ')[0]),datasets:[{label:'Pris',data:comms.map(c=>ip(c.matricule)?this.getPrise(ip(c.matricule)!):0),backgroundColor:'rgba(26,107,42,.5)',borderRadius:4},{label:'Vendus',data:comms.map(c=>ip(c.matricule)?this.getVendu(ip(c.matricule)!):0),backgroundColor:'rgba(26,107,42,1)',borderRadius:4},{label:'Restants',data:comms.map(c=>ip(c.matricule)?this.getRestant(ip(c.matricule)!):0),backgroundColor:'rgba(230,81,0,.7)',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{family:'DM Sans',size:11},usePointStyle:true}}},scales:{x:{grid:{display:false},ticks:{font:{family:'DM Sans',size:11}}},y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.04)'},ticks:{font:{family:'DM Sans',size:10}}}}}}));}
  private buildPerfChart(){const ctx=this.perfCanvas.nativeElement.getContext('2d')!;const rates=this.commercials().map(c=>{const ip=this.infos().find(x=>x.commercialId===c.matricule);return ip?this.getTaux(ip):0;});this.charts.push(new Chart(ctx,{type:'doughnut',data:{labels:this.commercials().map(c=>c.name.split(' ')[0]),datasets:[{data:rates,backgroundColor:['rgba(20,83,45,.85)','rgba(246,182,11,.85)','rgba(200,168,0,.85)'],borderWidth:3,borderColor:'#fff',hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{family:'DM Sans',size:11},padding:10,usePointStyle:true}},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed}% taux de vente`}}}}}));}
  getInfoForComm(mat?:string){return this.infos().find(ip=>ip.commercialId===mat);}
  getPrise(ip:InfoProduits){return ip.lines.reduce((a:number,l:InfoProduitsLine)=>a+l.takenQty,0);}
  getVendu(ip:InfoProduits){return ip.lines.reduce((a:number,l:InfoProduitsLine)=>a+l.soldQty,0);}
  getRestant(ip:InfoProduits){return ip.lines.reduce((a:number,l:InfoProduitsLine)=>a+l.returnedQty,0);}
  getTaux(ip:InfoProduits){const p=this.getPrise(ip);return p>0?Math.round((this.getVendu(ip)/p)*100):0;}
  getMontant(ip:InfoProduits){return ip.montantTotal||ip.lines.reduce((a:number,l:InfoProduitsLine)=>a+(l.soldQty*(l.unitPrice||0)),0);}
  getTotalVentes(){return this.infos().reduce((a,ip)=>a+this.getMontant(ip),0);}
  getTotalVendus(){return this.infos().reduce((a,ip)=>a+this.getVendu(ip),0);}
  getTauxGlobal(){const tp=this.infos().reduce((a,ip)=>a+this.getPrise(ip),0);return tp>0?Math.round((this.getTotalVendus()/tp)*100):0;}
  getStatusClass(s:string){const m:Record<string,string>={DRAFT:'badge-warning',PENDING_CASH:'badge-primary',PENDING_ACCOUNTANT:'badge-secondary',CLOSED:'badge-success',APPROVED:'badge-success',REJECTED:'badge-danger'};return m[s]||'badge-neutral';}
  getStatusLabel(s:string){const m:Record<string,string>={DRAFT:'Préparé',PENDING_CASH:'Att. caissière',PENDING_ACCOUNTANT:'Att. comptable',CLOSED:'Clôturé',APPROVED:'Approuvée',REJECTED:'Rejetée'};return m[s]||s;}
  filteredCommercials(){const q=this.search().toLowerCase();return q?this.commercials().filter(c=>c.name.toLowerCase().includes(q)||(c.matricule||'').toLowerCase().includes(q)):this.commercials();}
  infosForSelected(){const c=this.detailComm();return c?this.infos().filter(ip=>ip.commercialId===c.matricule||ip.commercialMatricule===c.matricule):[];}
  handleQueryParams(){
    combineLatest([this.route.queryParams,this.commercials$]).pipe(takeUntil(this.d$))
    .subscribe(([params,list])=>{const m=params['matricule'];if(!m)return;const found=list.find((x:Commercial)=>x.matricule===m);if(found){this.openDetail(found);this.router.navigate([],{relativeTo:this.route,queryParams:{}});}});
  }
  openDetail(c:Commercial){this.detailComm.set(c);this.activeTab.set('info');this.detailLoading.set(true);this.dotationUC.getByCommercial(c.matricule||'').pipe(takeUntil(this.d$)).subscribe({next:h=>{this.dotationHistory.set(h);this.detailLoading.set(false);},error:()=>this.detailLoading.set(false)});}
  closeDetail(){this.detailComm.set(null);this.activeTab.set('dashboard');this.router.navigate([],{relativeTo:this.route,queryParams:{}});}
  setTab(tab:'dashboard'|'info'|'dotations'){this.activeTab.set(tab);if(tab==='dotations'&&this.allDotations().length===0){this.dotationUC.getAll().pipe(takeUntil(this.d$)).subscribe({next:d=>this.allDotations.set(d),error:()=>this.allDotations.set([])});}}
  openDotation(c:Commercial){this.selectedComm.set(c);this.dotationLines=this.pfLevels().map(sl=>({productId:sl.productId,productName:sl.productName||'',productSku:sl.productSku||'',qty:0,unitType:(sl.productUnit||'SACHET_42G') as UnitType,unitsPerPack:1}));this.showDotation.set(true);}
  closeDotation(){this.showDotation.set(false);this.selectedComm.set(null);}
  getDotTotal(){return this.dotationLines.reduce((a,l)=>a+(l.qty*l.unitsPerPack),0);}
  submitDotation(){
    const comm=this.selectedComm();if(!comm||!comm.matricule)return;
    const user=this.auth.getCurrentUser();if(!user){this.showToast('Utilisateur non authentifié','error');return;}
    const items:DotationItem[]=this.dotationLines.filter(l=>l.qty>0).map(l=>({productId:l.productId,productSku:l.productSku,productName:l.productName,requestedQuantity:l.qty*l.unitsPerPack,packagingType:l.unitType}));
    if(items.length===0){this.showToast('Aucune ligne de dotation','error');return;}
    const overStock=this.dotationLines.filter((l,i)=>l.qty>0 && this.pfLevels()[i] && l.qty>this.pfLevels()[i].quantity);
    if(overStock.length>0){const names=overStock.map(l=>l.productName).join(', ');this.showToast(`Stock PF insuffisant pour: ${names}`,'error');return;}
    const payload:CreateDotationRequest={commercialId:comm.matricule,commercialMatricule:comm.matricule,commercialName:comm.name,justification:`Dotation depuis module commercial — ${this.today.toLocaleDateString('fr-CM')}`,items};
    this.dotationSaving.set(true);
    this.dotationUC.create(payload).pipe(takeUntil(this.d$)).subscribe({
      next:()=>{this.dotationSaving.set(false);this.closeDotation();this.showToast('Dotation créée et soumise au workflow de validation.','success');this.loadAll();},
      error:(err)=>{this.dotationSaving.set(false);this.showToast(`Erreur: ${err.message||'Échec création dotation'}`,'error');}
    });
  }
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  showToast(msg:string,type:'success'|'error'){this.toastMsg.set(msg);this.toastType.set(type);setTimeout(()=>this.toastMsg.set(''),4500);}
  ngOnDestroy(){this.charts.forEach(c=>c.destroy());this.d$.next();this.d$.complete();}
}
