// src/app/services/product.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Product, Category, ProductFilter } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  constructor(private apiService: ApiService) {}

  getProducts(filters?: ProductFilter): Observable<Product[]> {
    // Convert filters to query params
    const params: any = {};
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof ProductFilter] !== undefined) {
          params[key] = filters[key as keyof ProductFilter];
        }
      });
    }

    return this.apiService.get<Product[]>('/products', { params });
  }

  getProduct(id: number): Observable<Product> {
    return this.apiService.get<Product>(`/products/${id}`);
  }

  getCategories(activeOnly = false): Observable<Category[]> {
    return this.apiService.get<Category[]>('/categories', { 
      params: { active_only: activeOnly } 
    });
  }

  getCategory(id: number): Observable<Category> {
    return this.apiService.get<Category>(`/categories/${id}`);
  }

  getProductsByCategory(categoryId: number, activeOnly = true): Observable<Product[]> {
    return this.apiService.get<Product[]>(`/products/category/${categoryId}`, {
      params: { active_only: activeOnly }
    });
  }
}