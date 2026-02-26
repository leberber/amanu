import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { OrderItem } from '../../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderTranslationService {
  private productService = inject(ProductService);

  loadTranslatedItems(items: OrderItem[]): Observable<OrderItem[]> {
    if (!items || items.length === 0) {
      return of([]);
    }

    const productObservables = items.map(item =>
      this.productService.getProduct(item.product_id).pipe(
        map(product => ({
          itemId: item.id,
          translatedName: product.name,
          imageUrl: product.image_url || ''
        })),
        catchError(() => of({
          itemId: item.id,
          translatedName: item.product_name,
          imageUrl: ''
        }))
      )
    );

    return forkJoin(productObservables).pipe(
      map(results => items.map(item => {
        const data = results.find(r => r.itemId === item.id);
        return data ? {
          ...item,
          product_name: data.translatedName,
          product_image_url: data.imageUrl
        } : item;
      }))
    );
  }
}
