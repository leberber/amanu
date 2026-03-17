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
  private toast = inject(ToastMessageService);

  // Constants
  readonly ROUTES = ROUTES;

  categories = signal<Array<{
    id: number;
    name: string;
    description: string;
    image: string;
    link: string;
  }>>([]);

  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Subscribe to language changes - BehaviorSubject emits immediately on subscribe
    // so no need for separate loadCategories() call
    this.translationService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadCategories();
      });
  }


  private loadCategories(): void {
    this.productService.getCategories(true).subscribe({
      next: (apiCategories: Category[]) => {
        const transformedCategories = apiCategories.map(category => ({
          id: category.id,
          name: category.name,
          description: category.description || '',
          image: category.image_url || '',
          link: `/products?category=${category.id}`
        }));
        
        this.categories.set(transformedCategories);
      },
      error: (error) => {
        this.toast.showApiError(error, 'errors.load_categories_failed');
      }
    });
  }
}