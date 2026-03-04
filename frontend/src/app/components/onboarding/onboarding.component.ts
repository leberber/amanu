import { Component, OnInit, signal, output, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { StorageService } from '../../core/services/storage.service';
import { UI, GESTURE } from '../../core/constants/ui.constants';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';

interface OnboardingSlide {
  icon?: string;
  titleKey: string;
  descriptionKey: string;
  color: string;
  type?: 'default' | 'filter' | 'welcome'; // Special slide types
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [TranslateModule, LanguageSelectorComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent implements OnInit {
  private readonly storage = inject(StorageService);

  show = signal(false);
  currentSlide = signal(0);
  exiting = signal(false);

  // Emit when completing - parent should show splash first
  completed = output<void>();

  private touchStartX = 0;
  private touchEndX = 0;

  // Brand/category icons for filter slide
  filterImages = [
    { url: '/categories-icon.png', labelKey: 'common.category' },
    { url: '/brands-icon.png', labelKey: 'common.brand' }
  ];

  slides: OnboardingSlide[] = [
    {
      titleKey: 'onboarding.slide1_title',
      descriptionKey: 'onboarding.slide1_desc',
      color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      type: 'welcome'
    },
    {
      icon: 'pi-filter',
      titleKey: 'onboarding.slide_filter_title',
      descriptionKey: 'onboarding.slide_filter_desc',
      color: 'linear-gradient(135deg, #14b8a6, #0d9488)',
      type: 'filter'
    },
    {
      icon: 'pi-cart-plus',
      titleKey: 'onboarding.slide2_title',
      descriptionKey: 'onboarding.slide2_desc',
      color: 'linear-gradient(135deg, #10b981, #059669)'
    },
    {
      icon: 'pi-truck',
      titleKey: 'onboarding.slide3_title',
      descriptionKey: 'onboarding.slide3_desc',
      color: 'linear-gradient(135deg, #f59e0b, #d97706)'
    },
    {
      icon: 'pi-credit-card',
      titleKey: 'onboarding.slide4_title',
      descriptionKey: 'onboarding.slide4_desc',
      color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
    },
    {
      icon: 'pi-bell',
      titleKey: 'onboarding.slide5_title',
      descriptionKey: 'onboarding.slide5_desc',
      color: 'linear-gradient(135deg, #ec4899, #db2777)'
    },
    {
      icon: 'pi-history',
      titleKey: 'onboarding.slide6_title',
      descriptionKey: 'onboarding.slide6_desc',
      color: 'linear-gradient(135deg, #6366f1, #4f46e5)'
    }
  ];

  ngOnInit(): void {
    // Show onboarding only on first app visit (device-based)
    if (!this.storage.hasSeenOnboarding()) {
      this.show.set(true);
    }
  }

  nextSlide(): void {
    if (this.currentSlide() < this.slides.length - 1) {
      this.currentSlide.update(v => v + 1);
    } else {
      this.complete();
    }
  }

  prevSlide(): void {
    if (this.currentSlide() > 0) {
      this.currentSlide.update(v => v - 1);
    }
  }

  goToSlide(index: number): void {
    this.currentSlide.set(index);
  }

  skip(): void {
    this.complete();
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe(): void {
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > GESTURE.SWIPE_THRESHOLD) {
      if (diff > 0) {
        // Swipe left - next slide
        this.nextSlide();
      } else {
        // Swipe right - previous slide
        this.prevSlide();
      }
    }
  }

  complete(): void {
    if (this.exiting()) return; // Prevent double calls
    this.exiting.set(true);
    this.storage.markOnboardingSeen();
    // Emit first so parent can show splash, then hide after small delay
    this.completed.emit();
    setTimeout(() => {
      this.show.set(false);
    }, UI.FOCUS_DELAY);
  }
}
