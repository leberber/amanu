// frontend/src/app/services/product.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { TranslationService } from './translation.service';
import { Product, Category, ProductFilter } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiService = inject(ApiService);
  private translationService = inject(TranslationService);

  // Product methods
  createProduct(productData: any): Observable<Product> {
    return this.apiService.post<Product>('/products', productData);
  }

  updateProduct(productId: number, productData: any): Observable<Product> {
    return this.apiService.patch<Product>(`/products/${productId}`, productData);
  }

  deleteProduct(productId: number): Observable<void> {
    return this.apiService.delete<void>(`/products/${productId}`);
  }

  // 🌍 UPDATED: Automatically include language parameter
  getProducts(filters?: ProductFilter): Observable<Product[]> {
    const params: any = {
      lang: this.translationService.getCurrentLanguage() // Add current language
    };
    
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof ProductFilter] !== undefined) {
          params[key] = filters[key as keyof ProductFilter];
        }
      });
    }

    return this.apiService.get<Product[]>('/products', { params });
  }

  // 🌍 UPDATED: Include language parameter
  getProduct(id: number): Observable<Product> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Product>(`/products/${id}`, { params });
  }

  // 🌍 UPDATED: Include language parameter
  getProductsByCategory(categoryId: number, activeOnly = true): Observable<Product[]> {
    const params = {
      active_only: activeOnly,
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Product[]>(`/products/category/${categoryId}`, { params });
  }

  // Category methods with translation support
  createCategory(categoryData: any): Observable<Category> {
    return this.apiService.post<Category>('/categories', categoryData);
  }

  updateCategory(categoryId: number, categoryData: any): Observable<Category> {
    return this.apiService.patch<Category>(`/categories/${categoryId}`, categoryData);
  }

  deleteCategory(categoryId: number): Observable<void> {
    return this.apiService.delete<void>(`/categories/${categoryId}`);
  }

  // 🌍 UPDATED: Include language parameter for categories
  getCategories(activeOnly = false): Observable<Category[]> {
    const params = { 
      active_only: activeOnly,
      lang: this.translationService.getCurrentLanguage() // Add current language
    };
    return this.apiService.get<Category[]>('/categories', { params });
  }

  // 🌍 UPDATED: Include language parameter
  getCategory(id: number): Observable<Category> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Category>(`/categories/${id}`, { params });
  }

  // 🆕 NEW: Method to refresh data when language changes
  refreshDataForLanguage(): void {
    // This can be called when language changes to refresh any cached data
    console.log('Language changed to:', this.translationService.getCurrentLanguage());
  }
}