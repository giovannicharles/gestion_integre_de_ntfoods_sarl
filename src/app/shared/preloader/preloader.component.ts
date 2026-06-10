import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-preloader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preloader.component.html',
  styleUrls: ['./preloader.component.css']
})
export class PreloaderComponent implements OnInit {
  loading = true;

  ngOnInit() {
    // Simuler le chargement initial
    setTimeout(() => {
      this.loading = false;
    }, 2000);
  }
}
