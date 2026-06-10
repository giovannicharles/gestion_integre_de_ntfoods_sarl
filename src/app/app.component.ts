import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PreloaderComponent } from './shared/preloader/preloader.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PreloaderComponent],
  template: '<app-preloader /><router-outlet />'
})
export class AppComponent { }
