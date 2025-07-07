// src/app/app.component.ts
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { ViewportService } from './services/viewport.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ButtonModule, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  title = 'Fresh Produce';
  private viewportService = inject(ViewportService);
}

// src/app/app.component.ts
