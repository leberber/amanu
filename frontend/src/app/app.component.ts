// src/app/app.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HeaderComponent } from './layout/header/header.component';
import { BottomNavigationComponent } from './components/bottom-navigation/bottom-navigation.component';
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
    BottomNavigationComponent, // Add this import
    TranslateModule
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  title = 'Fresh Produce';
  
  private viewportService = inject(ViewportService);
  private translationService = inject(TranslationService);

  ngOnInit() {
    // Initialize translation service
    // The service will automatically load the saved language or default to French
  }
}