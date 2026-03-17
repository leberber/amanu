// frontend/src/app/pages/home/home.component.ts
import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TranslateModule } from '@ngx-translate/core';

import { ProductService } from '../../services/product.service';
import { TranslationService } from '../../services/translation.service';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { TranslationHelperService } from '../../core/services/translation-helper.service';
import { Category } from '../../models/product.model';
import { ROUTES } from '../../core/constants/routes.constants';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ButtonModule, CardModule, TranslateModule, ImageFallbackDirective],
  templateUrl: './home.component.html'

})
export class HomeComponent implements OnInit {
  private productService = inject(ProductService);
  private translationService = inject(TranslationService);
  private translationHelper = inject(TranslationHelperService);
  private toast = inject(ToastMessageService);
  private destroyRef = inject(DestroyRef);

  // Constants
  readonly ROUTES = ROUTES;

  // Raw categories from API (with translations embedded)
  private rawCategories = signal<Category[]>([]);

  // Transformed categories for display
  categories = signal<Array<{
    id: number;
    name: string;
    description: string;
    image: string;
    link: string;
  }>>([]);

  ngOnInit(): void {
    // Load categories once
    this.loadCategories();

    // On language change, re-transform using embedded translations (no API call)
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.transformCategories());
  }

  private loadCategories(): void {
    this.productService.getCategories(true).subscribe({
      next: (apiCategories: Category[]) => {
        this.rawCategories.set(apiCategories);
        this.transformCategories();
      },
      error: (error) => {
        this.toast.showApiError(error, 'errors.load_categories_failed');
      }
    });
  }

  private transformCategories(): void {
    const transformed = this.rawCategories().map(category => ({
      id: category.id,
      name: this.translationHelper.getCategoryName(category),
      description: this.translationHelper.getCategoryDescription(category),
      image: category.image_url || '',
      link: `/products?category=${category.id}`
    }));
    this.categories.set(transformed);
  }
}