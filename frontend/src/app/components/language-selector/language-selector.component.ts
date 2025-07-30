// src/app/components/language-selector/language-selector.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { TranslationService, Language } from '../../services/translation.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    TranslateModule
  ],
  template: `
    <div class="language-selector">
      <!-- Language trigger button -->
      <p-button 
        [label]="getCurrentLanguageDisplay()" 
        (onClick)="showLanguageDialog = true"
        severity="secondary"
        text
        size="small"
        styleClass="language-trigger"
      />
      
      <!-- Language selection dialog -->
      <p-dialog 
        [(visible)]="showLanguageDialog"
        [header]="'language.select' | translate"
        [modal]="true"
        [closable]="true"
        [draggable]="false"
        [resizable]="false"
        [blockScroll]="true"
        [dismissableMask]="true"
        [closeOnEscape]="true"
        styleClass="language-dialog"
        [style]="{width: '300px'}"
        appendTo="body"
      >
        <div class="language-options">
          <div 
            *ngFor="let language of languageOptions()" 
            class="language-option"
            [class.selected]="language.code === getCurrentLanguageCode()"
            (click)="selectLanguage(language.code)"
          >
            <span class="language-flag">{{ getLanguageFlag(language.code) }}</span>
            <span class="language-name">{{ getLanguageName(language.code) }}</span>
            <i *ngIf="language.code === getCurrentLanguageCode()" class="pi pi-check language-check"></i>
          </div>
        </div>
      </p-dialog>
    </div>
  `,
  styles: [`
    .language-selector {
      min-width: 120px;
    }

    .language-trigger {
      min-width: 120px;
    }

    :host ::ng-deep .language-dialog {
      z-index: 999999 !important;
    }

    :host ::ng-deep .language-dialog .p-dialog-mask {
      z-index: 999998 !important;
      background-color: rgba(0, 0, 0, 0.4) !important;
    }

    :host ::ng-deep .language-dialog .p-dialog-content {
      padding: 0;
    }

    .language-options {
      display: flex;
      flex-direction: column;
    }

    .language-option {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: background-color 0.2s ease;
      border-bottom: 1px solid var(--surface-border);
    }

    .language-option:last-child {
      border-bottom: none;
    }

    .language-option:hover {
      background-color: var(--surface-hover);
    }

    .language-option.selected {
      background-color: var(--primary-50);
      color: var(--primary-color);
    }

    .language-flag {
      font-size: 1.2rem;
      min-width: 24px;
    }

    .language-name {
      flex: 1;
      font-weight: 500;
    }

    .language-check {
      color: var(--primary-color);
      font-weight: bold;
    }
  `]
})
export class LanguageSelectorComponent implements OnInit {
  private translationService = inject(TranslationService);
  private translateService = inject(TranslateService);

  languageOptions = signal<{code: string, label: string}[]>([]);
  showLanguageDialog = false;

  ngOnInit(): void {
    this.buildLanguageOptions();
    
    this.translationService.currentLanguage$.subscribe(() => {
      this.buildLanguageOptions();
    });
  }

  private buildLanguageOptions(): void {
    const options = this.translationService.availableLanguages.map((language: Language) => ({
      code: language.code,
      label: `${language.flag} ${language.name}`
    }));

    this.languageOptions.set(options);
  }

  selectLanguage(languageCode: string): void {
    this.translationService.setLanguage(languageCode);
    this.showLanguageDialog = false; // Close dialog after selection
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
}