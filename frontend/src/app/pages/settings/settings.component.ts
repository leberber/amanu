import { Component, inject, signal, computed } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserPreferencesService, ViewMode } from '../../core/services/user-preferences.service';
import { STORAGE_KEYS } from '../../core/constants/app.constants';
import { ROUTES } from '../../core/constants/routes.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

interface Language {
  code: string;
  name: string;
  flag: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslateModule, PageLayoutComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private translateService = inject(TranslateService);
  private preferencesService = inject(UserPreferencesService);

  readonly routes = ROUTES;

  languages: Language[] = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
  ];

  currentLanguage = signal(this.translateService.currentLang || 'en');
  currentViewMode = computed(() => this.preferencesService.productViewMode());

  setLanguage(code: string): void {
    this.translateService.use(code);
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, code);
    this.currentLanguage.set(code);

    // Update document direction for RTL languages
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  }

  setViewMode(mode: ViewMode): void {
    this.preferencesService.setProductViewMode(mode);
  }
}
