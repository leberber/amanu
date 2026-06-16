// frontend/src/app/services/product.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { TranslationService } from './translation.service';
import { Product, Category, ProductFilter, PaginatedProductsResponse, AdminProductFilter, ProductGroupPrice, ProductGroupPriceUpsert } from '../models/product.model';

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

  // Automatically include language parameter
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

    return this.apiService.get<Product[]>('/products', { params }).pipe(
      map(products => products.sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  // Include language parameter
  getProduct(id: number): Observable<Product> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Product>(`/products/${id}`, { params });
  }

  // Include language parameter
  getProductsByCategory(categoryId: number, activeOnly = true): Observable<Product[]> {
    const params = {
      active_only: activeOnly,
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Product[]>(`/products/category/${categoryId}`, { params }).pipe(
      map(products => products.sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  // Get products by brand
  getProductsByBrand(brandId: number, activeOnly = true): Observable<Product[]> {
    const params: any = {
      brand_id: brandId,
      lang: this.translationService.getCurrentLanguage()
    };
    if (!activeOnly) {
      params.active_only = false;
    }
    return this.apiService.get<Product[]>('/products', { params }).pipe(
      map(products => products.sort((a, b) => a.name.localeCompare(b.name)))
    );
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

  // Include language parameter for categories
  getCategories(activeOnly = false): Observable<Category[]> {
    const params = {
      active_only: activeOnly,
      lang: this.translationService.getCurrentLanguage() // Add current language
    };
    return this.apiService.get<Category[]>('/categories', { params }).pipe(
      map(categories => categories.sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  // Include language parameter
  getCategory(id: number): Observable<Category> {
    const params = {
      lang: this.translationService.getCurrentLanguage()
    };
    return this.apiService.get<Category>(`/categories/${id}`, { params });
  }

  // Method to refresh data when language changes
  refreshDataForLanguage(): void {
    // This can be called when language changes to refresh any cached data
  }

  /**
   * Admin endpoint: Get paginated products with total counts
   * Returns items + total count + active/inactive counts
   */
  getProductsPaginated(filters: AdminProductFilter): Observable<PaginatedProductsResponse> {
    const params: any = {
      lang: this.translationService.getCurrentLanguage(),
      skip: filters.skip ?? 0,
      limit: filters.limit ?? 50,
    };

    if (filters.category_id) params.category_id = filters.category_id;
    if (filters.brand_id) params.brand_id = filters.brand_id;
    if (filters.status_filter) params.status_filter = filters.status_filter;
    if (filters.search) params.search = filters.search;

    return this.apiService.get<PaginatedProductsResponse>('/products/admin/paginated', { params });
  }

  getGroupPrices(productId: number): Observable<ProductGroupPrice[]> {
    return this.apiService.get<ProductGroupPrice[]>(`/products/${productId}/group-prices`);
  }

  setGroupPrices(productId: number, prices: ProductGroupPriceUpsert[]): Observable<ProductGroupPrice[]> {
    return this.apiService.put<ProductGroupPrice[]>(`/products/${productId}/group-prices`, prices);
  }
}