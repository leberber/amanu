import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslationService, Language } from '../../services/translation.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [FormsModule, SelectModule],
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.scss'
})
export class LanguageSelectorComponent implements OnInit {
  private translationService = inject(TranslationService);
  private destroyRef = inject(DestroyRef);

  selectedLanguage = signal<Language | null>(null);

  // Computed values
  languages = computed(() => this.translationService.availableLanguages);
  currentFlag = computed(() => this.selectedLanguage()?.flag || '');
  currentName = computed(() => this.selectedLanguage()?.name || '');

  ngOnInit(): void {
    this.selectedLanguage.set(this.translationService.getCurrentLanguageObject());

    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.selectedLanguage.set(this.translationService.getCurrentLanguageObject());
      });
  }

  onLanguageChange(event: { value: Language }): void {
    if (event.value?.code) {
      this.translationService.setLanguage(event.value.code);
    }
  }
}
