import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { STORAGE_KEYS } from '../../core/constants/app.constants';

interface OnboardingSlide {
  icon: string;
  titleKey: string;
  descriptionKey: string;
  color: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent implements OnInit {
  show = signal(false);
  currentSlide = signal(0);
  exiting = signal(false);

  private touchStartX = 0;
  private touchEndX = 0;

  slides: OnboardingSlide[] = [
    {
      icon: 'pi-shopping-cart',
      titleKey: 'onboarding.slide1_title',
      descriptionKey: 'onboarding.slide1_desc',
      color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
    },
    {
      icon: 'pi-plus-circle',
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
    // TODO: Remove this line after testing - always show for testing
    this.show.set(true);
    return;

    const hasSeenOnboarding = localStorage.getItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING);
    if (!hasSeenOnboarding) {
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
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
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
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, 'true');
      this.show.set(false);
    }, 300);
  }
}
