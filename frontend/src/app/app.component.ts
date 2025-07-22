// src/app/app.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { ViewportService } from './services/viewport.service';
import { TranslationService } from './services/translation.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, 
    ButtonModule, 
    HeaderComponent,
    TranslateModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'Fresh Produce';
  
  private viewportService = inject(ViewportService);
  private translationService = inject(TranslationService);

  ngOnInit() {
    // Initialize translation service
    // The service will automatically load the saved language or default to French
    console.log('App initialized with language:', this.translationService.getCurrentLanguage());
  }
}