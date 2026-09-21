import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-commercial-dotations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page animate-fadeInUp">
      <div class="ph">
        <div class="ph-left">
          <div class="ph-icon"><i class="fa-solid fa-hand-holding"></i></div>
          <div><h1 class="ph-title">Mes Dotations</h1><p class="ph-sub">Suivi de vos dotations de stock</p></div>
        </div>
      </div>
      <div class="card">
        <div class="card-body" style="text-align:center;padding:48px;color:var(--n400)">
          <i class="fa-solid fa-hand-holding" style="font-size:32px;margin-bottom:12px"></i>
          <p>Module en cours de developpement</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 20px; }
    .ph { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .ph-left { display: flex; align-items: center; gap: 12px; }
    .ph-icon { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, var(--g-m), var(--g)); color: white; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .ph-title { font-size: 20px; font-weight: 800; color: var(--n900); margin: 0; }
    .ph-sub { font-size: 13px; color: var(--n500); margin: 2px 0 0; }
    .card { background: white; border: 1px solid var(--n200); border-radius: var(--r-lg); box-shadow: 0 2px 8px rgba(0,0,0,.05); }
    .card-body { padding: 20px; }
  `]
})
export class CommercialDotationsComponent {}
