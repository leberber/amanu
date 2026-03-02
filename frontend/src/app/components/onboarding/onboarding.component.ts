import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { STORAGE_KEYS } from '../../core/constants/app.constants';

interface OnboardingSlide {
  icon: string;
  titleKey: string;
  descriptionKey: string;
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

  slides: OnboardingSlide[] = [
    {
      icon: 'pi-shopping-cart',
      titleKey: 'onboarding.slide1_title',
      descriptionKey: 'onboarding.slide1_desc'
    },
    {
      icon: 'pi-truck',
      titleKey: 'onboarding.slide2_title',
      descriptionKey: 'onboarding.slide2_desc'
    },
    {
      icon: 'pi-phone',
      titleKey: 'onboarding.slide3_title',
      descriptionKey: 'onboarding.slide3_desc'
    }
  ];

  ngOnInit(): void {
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

  private complete(): void {
    this.exiting.set(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, 'true');
      this.show.set(false);
    }, 300);
  }
}
