import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { CommercialUseCase } from '../../../application/use-cases/commercial/commercial.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { Commercial, InfoProduits, InfoProduitsLine } from '../../../domain/models';
@Component({ selector:'app-session', standalone:true, imports:[CommonModule,DatePipe,DecimalPipe,RouterLink,FormsModule], templateUrl:'./session.component.html', styleUrls:['./session.component.css'] })
export class SessionComponent implements OnInit, OnDestroy {
  private d$=new Subject<void>(); private uc=inject(CommercialUseCase); private repo=inject(StockApiRepository);
  loading=signal(true); infos=signal<InfoProduits[]>([]); comms=signal<Commercial[]>([]);
  today=new Date(); selectedDate=signal<string>(new Date().toISOString().split('T')[0]); activeTab=signal<'info'|'comms'>('info');
  search=signal(''); statusFilter=signal<string>('');
  getPrise(ip:InfoProduits){return ip.lines.reduce((a:number,l:InfoProduitsLine)=>a+l.takenQty,0);}
  getVendu(ip:InfoProduits){return ip.lines.reduce((a:number,l:InfoProduitsLine)=>a+l.soldQty,0);}
  getRestant(ip:InfoProduits){return ip.lines.reduce((a:number,l:InfoProduitsLine)=>a+l.returnedQty,0);}
  getTaux(ip:InfoProduits){const p=this.getPrise(ip);return p>0?Math.round((this.getVendu(ip)/p)*100):0;}
  getMontant(ip:InfoProduits){return ip.montantTotal||ip.lines.reduce((a:number,l:InfoProduitsLine)=>a+(l.soldQty*(l.unitPrice||0)),0);}
  get totalPris(){return this.infos().reduce((a,ip)=>a+this.getPrise(ip),0);}
  get totalVendus(){return this.infos().reduce((a,ip)=>a+this.getVendu(ip),0);}
  get totalRestants(){return this.infos().reduce((a,ip)=>a+this.getRestant(ip),0);}
  get totalMontant(){return this.infos().reduce((a,ip)=>a+this.getMontant(ip),0);}
  getInfoColor(s:string){const m:Record<string,string>={DRAFT:'badge-warning',PENDING_CASH:'badge-primary',PENDING_ACCOUNTANT:'badge-secondary',CLOSED:'badge-success'};return m[s]||'badge-neutral';}
  getInfoLabel(s:string){const m:Record<string,string>={DRAFT:'Préparé',PENDING_CASH:'Att. caissière',PENDING_ACCOUNTANT:'Att. comptable',CLOSED:'Clôturé'};return m[s]||s;}
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  load(){this.loading.set(true);forkJoin({i:this.uc.getInfoProduits(this.selectedDate()),c:this.uc.getCommercials()}).pipe(takeUntil(this.d$)).subscribe({next:({i,c})=>{this.infos.set(i);this.comms.set(c);this.loading.set(false);},error:()=>this.loading.set(false)});}
  ngOnInit(){this.load();}
  setDate(v:string){this.selectedDate.set(v);this.load();}
  shiftDate(days:number){const d=new Date(this.selectedDate());d.setDate(d.getDate()+days);this.setDate(d.toISOString().split('T')[0]);}
  filteredInfos(){const q=this.search().toLowerCase();const s=this.statusFilter();return this.infos().filter(ip=>(q?(ip.commercial?.name||ip.commercialMatricule||'').toLowerCase().includes(q):true)&&(s?ip.status===s:true));}
  filteredComms(){const q=this.search().toLowerCase();return this.comms().filter(c=>(c.name||'').toLowerCase().includes(q)||(c.matricule||'').toLowerCase().includes(q));}
  getAverageTaux(){const list=this.infos();return list.length?Math.round(list.reduce((a,ip)=>a+this.getTaux(ip),0)/list.length):0;}
  getCommercialSales(mat?:string){return this.infos().filter(ip=>ip.commercialId===mat||ip.commercialMatricule===mat).reduce((a,ip)=>a+this.getMontant(ip),0);}
  printSummary(){window.print();}
  ngOnDestroy(){this.d$.next();this.d$.complete();}
}
