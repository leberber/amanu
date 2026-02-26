import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';


@Injectable({
  providedIn: 'root'
})
export class CartTranslationService {
  private productService = inject(ProductService);


  loadTranslatedNames<T extends { id: string | number; product_id: number; product_name: string }>(
    items: T[]
  ): Observable<T[]> {
    if (items.length === 0) {
      return of([]);
    }

    const productObservables = items.map(item =>
      this.productService.getProduct(item.product_id).pipe(
        map(product => ({
          itemId: item.id,
          translatedName: product.name,
        })),
        catchError(error => {
          console.error(`Error loading product ${item.product_id}:`, error);
          return of({
            itemId: item.id,
            translatedName: item.product_name,
          });
        })
      )
    );

    return forkJoin(productObservables).pipe(
      map(results => {
        return items.map(item => {
          const translation = results.find(r => r.itemId === item.id);
          if (translation) {
            return {
              ...item,
              product_name: translation.translatedName
            };
          }
          return item;
        });
      })
    );
  }
}
