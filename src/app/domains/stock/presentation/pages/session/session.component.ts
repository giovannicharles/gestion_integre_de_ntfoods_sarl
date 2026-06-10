import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { CommercialUseCase } from '../../../application/use-cases/commercial/commercial.use-case';
import { Commercial, InfoProduits } from '../../../domain/models/stock.models';
@Component({ selector:'app-session', standalone:true, imports:[CommonModule,DatePipe,DecimalPipe,RouterLink], templateUrl:'./session.component.html', styleUrls:['./session.component.css'] })
export class SessionComponent implements OnInit, OnDestroy {
  private d$=new Subject<void>(); private uc=inject(CommercialUseCase);
  loading=signal(true); infos=signal<InfoProduits[]>([]); comms=signal<Commercial[]>([]);
  today=new Date(); activeTab=signal<'info'|'comms'>('info');
  getPrise(ip:InfoProduits){return ip.lines.reduce((a,l)=>a+l.takenQty,0);}
  getVendu(ip:InfoProduits){return ip.lines.reduce((a,l)=>a+l.soldQty,0);}
  getRestant(ip:InfoProduits){return ip.lines.reduce((a,l)=>a+l.returnedQty,0);}
  getTaux(ip:InfoProduits){const p=this.getPrise(ip);return p>0?Math.round((this.getVendu(ip)/p)*100):0;}
  getMontant(ip:InfoProduits){return ip.montantTotal||ip.lines.reduce((a,l)=>a+(l.soldQty*(l.unitPrice||0)),0);}
  getInfoColor(s:string){const m:Record<string,string>={DRAFT:'badge-warning',PENDING_CASH:'badge-info',PENDING_ACCOUNTANT:'badge-secondary',CLOSED:'badge-success'};return m[s]||'badge-neutral';}
  getInfoLabel(s:string){const m:Record<string,string>={DRAFT:'Préparé',PENDING_CASH:'Att. caissière',PENDING_ACCOUNTANT:'Att. comptable',CLOSED:'Clôturé'};return m[s]||s;}
  fCFA(n:number){return new Intl.NumberFormat('fr-CM').format(Math.round(n))+' FCFA';}
  ngOnInit(){forkJoin({i:this.uc.getInfoProduits(),c:this.uc.getCommercials()}).pipe(takeUntil(this.d$)).subscribe({next:({i,c})=>{this.infos.set(i);this.comms.set(c);this.loading.set(false);},error:()=>this.loading.set(false)});}
  ngOnDestroy(){this.d$.next();this.d$.complete();}
}
