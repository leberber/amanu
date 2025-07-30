// frontend/src/app/pages/home/home.component.ts
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { ProductService } from '../../services/product.service';
import { TranslationService } from '../../services/translation.service';
import { Category } from '../../models/product.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ButtonModule, CardModule, TranslateModule],
  templateUrl: './home.component.html'

})
export class HomeComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private translationService = inject(TranslationService);
  
  categories = signal<Array<{
    id: number;
    name: string;
    description: string;
    image: string;
    link: string;
  }>>([]);
  
  private languageSubscription?: Subscription;

  ngOnInit(): void {
    this.languageSubscription = this.translationService.currentLanguage$.subscribe(() => {
      this.loadCategories();
    });
    
    this.loadCategories();
  }

  ngOnDestroy(): void {
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
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
        console.error('Error loading categories:', error);
      }
    });
  }
}