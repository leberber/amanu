// src/app/services/translation.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export interface Language {
  code: string;
  name: string;
  flag: string;
  rtl: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  // Available languages
  public readonly availableLanguages: Language[] = [
    { code: 'fr', name: 'Français', flag: '🇫🇷', rtl: false },
    { code: 'en', name: 'English', flag: '🇬🇧', rtl: false },
    { code: 'ar', name: 'الجزائرية', flag: '🇩🇿', rtl: true }
  ];

  // Default language
  private readonly defaultLanguage = 'fr';
  
  // Current language signals
  private currentLanguageSubject = new BehaviorSubject<string>(this.defaultLanguage);
  public currentLanguage$ = this.currentLanguageSubject.asObservable();
  
  // Signal for current language
  public currentLanguage = signal<string>(this.defaultLanguage);
  
  // Computed signal for current language object
  public currentLanguageObj = computed(() => {
    return this.availableLanguages.find(lang => lang.code === this.currentLanguage()) || this.availableLanguages[0];
  });
  
  // Computed signal for RTL direction
  public isRTL = computed(() => {
    return this.currentLanguageObj().rtl;
  });

  constructor(private translate: TranslateService) {
    this.initializeTranslation();
  }

  private initializeTranslation(): void {
    // Set available languages
    this.translate.addLangs(this.availableLanguages.map(lang => lang.code));
    
    // Set default language
    this.translate.setDefaultLang(this.defaultLanguage);
    
    // Get saved language from localStorage or use default
    const savedLanguage = this.getSavedLanguage();
    const languageToUse = this.isLanguageSupported(savedLanguage) ? savedLanguage : this.defaultLanguage;
    
    // Set initial language
    this.setLanguage(languageToUse);
  }

  private getSavedLanguage(): string {
    try {
      return localStorage.getItem('selected-language') || this.defaultLanguage;
    } catch (error) {
      console.warn('Could not access localStorage:', error);
      return this.defaultLanguage;
    }
  }

  private saveLanguage(language: string): void {
    try {
      localStorage.setItem('selected-language', language);
    } catch (error) {
      console.warn('Could not save language to localStorage:', error);
    }
  }

  private isLanguageSupported(language: string): boolean {
    return this.availableLanguages.some(lang => lang.code === language);
  }

  public setLanguage(language: string): void {
    if (!this.isLanguageSupported(language)) {
      console.warn(`Language '${language}' is not supported. Using default language '${this.defaultLanguage}'.`);
      language = this.defaultLanguage;
    }

    // Set the language in ngx-translate
    this.translate.use(language).subscribe({
      next: () => {
        // Update signals and subject
        this.currentLanguage.set(language);
        this.currentLanguageSubject.next(language);
        
        // Save to localStorage
        this.saveLanguage(language);
        
        // Update document direction and language attributes
        this.updateDocumentAttributes(language);
        
      },
      error: (error) => {
        console.error(`Error loading language '${language}':`, error);
        // Fallback to default language
        if (language !== this.defaultLanguage) {
          this.setLanguage(this.defaultLanguage);
        }
      }
    });
  }

  private updateDocumentAttributes(language: string): void {
    const html = document.documentElement;
    const languageObj = this.availableLanguages.find(lang => lang.code === language);
    
    if (languageObj) {
      // Set language attribute
      html.setAttribute('lang', language);
      
      // Set direction attribute
      html.setAttribute('dir', languageObj.rtl ? 'rtl' : 'ltr');
      
      // Update body class for RTL styling
      if (languageObj.rtl) {
        document.body.classList.add('rtl');
        document.body.classList.remove('ltr');
      } else {
        document.body.classList.add('ltr');
        document.body.classList.remove('rtl');
      }
    }
  }

  public getTranslation(key: string, params?: any): string {
    return this.translate.instant(key, params);
  }

  public getTranslationAsync(key: string, params?: any) {
    return this.translate.get(key, params);
  }

  // Helper method to get current language code
  public getCurrentLanguage(): string {
    return this.currentLanguage();
  }

  // Helper method to get current language object
  public getCurrentLanguageObject(): Language {
    return this.currentLanguageObj();
  }

  // Method to cycle through languages (useful for quick switching)
  public switchToNextLanguage(): void {
    const currentIndex = this.availableLanguages.findIndex(lang => lang.code === this.currentLanguage());
    const nextIndex = (currentIndex + 1) % this.availableLanguages.length;
    this.setLanguage(this.availableLanguages[nextIndex].code);
  }
}