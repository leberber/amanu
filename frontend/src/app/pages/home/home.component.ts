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
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private translationService = inject(TranslationService);
  
  // 🆕 Dynamic categories from API
  categories = signal<Array<{
    id: number;
    name: string;
    description: string;
    image: string;
    link: string;
  }>>([]);
  
  // 🆕 Subscription for language changes
  private languageSubscription?: Subscription;
  
  // 🆕 Fallback categories (in case API fails)
  private fallbackCategories = [
    { 
      name: 'home.categories.fresh_fruits.name',
      description: 'home.categories.fresh_fruits.description',
      image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1470&q=80',
      link: '/products?category=1'
    },
    { 
      name: 'home.categories.fresh_vegetables.name',
      description: 'home.categories.fresh_vegetables.description',
      image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=1442&q=80',
      link: '/products?category=2'
    },
    { 
      name: 'home.categories.organic_produce.name',
      description: 'home.categories.organic_produce.description',
      image: 'https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?auto=format&fit=crop&w=1442&q=80',
      link: '/products?category=3'
    }
  ];

  ngOnInit(): void {
    // 🆕 Subscribe to language changes - refresh categories when language changes
    this.languageSubscription = this.translationService.currentLanguage$.subscribe(() => {
      console.log('Language changed in home component, reloading categories...');
      this.loadCategories();
    });
    
    // Load initial categories
    this.loadCategories();
  }

  ngOnDestroy(): void {
    // 🆕 Cleanup language subscription
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  // 🆕 Load categories from API with translation support
  private loadCategories(): void {
    this.productService.getCategories(true).subscribe({
      next: (apiCategories: Category[]) => {
        console.log('Categories loaded from API with translations:', apiCategories);
        
        // Transform API categories to component format
        const transformedCategories = apiCategories.map(category => ({
          id: category.id,
          name: category.name, // This is already translated by the API
          description: category.description || '', // This is already translated by the API
          image: category.image_url || this.getDefaultImageForCategory(category.name),
          link: `/products?category=${category.id}`
        }));
        
        this.categories.set(transformedCategories);
      },
      error: (error) => {
        console.error('Error loading categories, using fallback:', error);
        // Use fallback categories if API fails
        this.categories.set(this.fallbackCategories.map((cat, index) => ({
          id: index + 1,
          name: cat.name,
          description: cat.description,
          image: cat.image,
          link: cat.link
        })));
      }
    });
  }

  // 🆕 Helper method to get default images based on category name
  private getDefaultImageForCategory(categoryName: string): string {
    const name = categoryName.toLowerCase();
    
    if (name.includes('fruit') || name.includes('فواكه')) {
      return 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1470&q=80';
    } else if (name.includes('vegetable') || name.includes('légume') || name.includes('خضروات')) {
      return 'https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=1442&q=80';
    } else if (name.includes('organic') || name.includes('bio') || name.includes('عضوي')) {
      return 'https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?auto=format&fit=crop&w=1442&q=80';
    } else {
      // Default fallback image
      return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1470&q=80';
    }
  }
}