import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslationService, Language } from '../../services/translation.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [],
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.scss'
})
export class LanguageSelectorComponent implements OnInit {
  private translationService = inject(TranslationService);
  private destroyRef = inject(DestroyRef);

  selectedLanguage = signal<Language | null>(null);
  languages = computed(() => this.translationService.availableLanguages);

  ngOnInit(): void {
    this.selectedLanguage.set(this.translationService.getCurrentLanguageObject());

    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.selectedLanguage.set(this.translationService.getCurrentLanguageObject());
      });
  }

  selectLanguage(lang: Language): void {
    this.translationService.setLanguage(lang.code);
  }
}
