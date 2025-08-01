// src/app/components/language-selector/language-selector.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { TranslationService, Language } from '../../services/translation.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SelectModule,
    TranslateModule
  ],
  template: `
    <div class="language-selector">
      <p-select 
        [options]="getLanguageOptionsForSelect()" 
        [(ngModel)]="selectedLanguage"
        [showClear]="false"
        appendTo="body"
        styleClass="language-dropdown"
        (onChange)="onLanguageChange($event)"
      >
        <ng-template pTemplate="selectedItem">
          <div class="flex align-items-center gap-2">
            <span>{{ getCurrentLanguageFlag() }}</span>
            <span>{{ getCurrentLanguageName() }}</span>
          </div>
        </ng-template>
        <ng-template let-option pTemplate="option">
          <div class="flex align-items-center gap-2">
            <span>{{ option.flag }}</span>
            <span>{{ option.name }}</span>
          </div>
        </ng-template>
      </p-select>
    </div>
  `,
  styles: [`
    .language-selector {
      min-width: 140px;
    }

    :host ::ng-deep .language-dropdown {
      min-width: 140px;
      
      .p-select {
        border: none;
        background: transparent;
        
        &:focus {
          box-shadow: none;
        }
      }
      
      .p-select-label {
        padding: 0.5rem 0.75rem;
      }
      
      .p-select-dropdown {
        width: 2.5rem;
      }
    }

    :host ::ng-deep .p-select-overlay {
      z-index: 99999 !important;
    }
  `]
})
export class LanguageSelectorComponent implements OnInit {
  private translationService = inject(TranslationService);
  private translateService = inject(TranslateService);

  languageOptions = signal<{code: string, label: string}[]>([]);
  selectedLanguage: any = null;

  ngOnInit(): void {
    this.buildLanguageOptions();
    this.selectedLanguage = this.translationService.getCurrentLanguageObject();
    
    this.translationService.currentLanguage$.subscribe(() => {
      this.buildLanguageOptions();
      this.selectedLanguage = this.translationService.getCurrentLanguageObject();
    });
  }

  private buildLanguageOptions(): void {
    const options = this.translationService.availableLanguages.map((language: Language) => ({
      code: language.code,
      label: `${language.flag} ${language.name}`
    }));

    this.languageOptions.set(options);
  }

  onLanguageChange(event: any): void {
    if (event.value && event.value.code) {
      this.translationService.setLanguage(event.value.code);
    }
  }

  getCurrentLanguageCode(): string {
    return this.translationService.getCurrentLanguage();
  }

  getCurrentLanguageDisplay(): string {
    const currentLang = this.translationService.getCurrentLanguageObject();
    return `${currentLang.flag} ${currentLang.name}`;
  }

  getLanguageFlag(code: string): string {
    const language = this.translationService.availableLanguages.find(lang => lang.code === code);
    return language?.flag || '';
  }

  getLanguageName(code: string): string {
    const language = this.translationService.availableLanguages.find(lang => lang.code === code);
    return language?.name || '';
  }

  getLanguageOptionsForSelect() {
    return this.translationService.availableLanguages;
  }

  getCurrentLanguageFlag(): string {
    const current = this.translationService.getCurrentLanguageObject();
    return current?.flag || '';
  }

  getCurrentLanguageName(): string {
    const current = this.translationService.getCurrentLanguageObject();
    return current?.name || '';
  }
}