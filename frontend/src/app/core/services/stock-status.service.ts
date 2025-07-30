import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PRODUCT } from '../constants/app.constants';

/**
 * Simple service to centralize stock status logic
 * Avoids duplicate stock checking code
 */
@Injectable({
  providedIn: 'root'
})
export class StockStatusService {
  private translateService = inject(TranslateService);

  /**
   * Get stock severity for PrimeNG tags
   * @param stockQuantity - Current stock quantity
   * @returns Severity level
   */
  getStockSeverity(stockQuantity: number): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    if (stockQuantity === PRODUCT.OUT_OF_STOCK_THRESHOLD) return 'danger';
    if (stockQuantity < PRODUCT.LOW_STOCK_THRESHOLD) return 'warn';
    if (stockQuantity < PRODUCT.MEDIUM_STOCK_THRESHOLD) return 'info';
    return 'success';
  }

  /**
   * Get stock label text
   * @param stockQuantity - Current stock quantity
   * @returns Translated stock label
   */
  getStockLabel(stockQuantity: number): string {
    if (stockQuantity === PRODUCT.OUT_OF_STOCK_THRESHOLD) {
      return this.translateService.instant('admin.products.stock.out_of_stock');
    }
    if (stockQuantity < PRODUCT.LOW_STOCK_THRESHOLD) {
      return this.translateService.instant('admin.products.stock.low_stock');
    }
    return this.translateService.instant('admin.products.stock.in_stock');
  }

  /**
   * Check if product is out of stock
   * @param stockQuantity - Current stock quantity
   * @returns true if out of stock
   */
  isOutOfStock(stockQuantity: number): boolean {
    return stockQuantity === PRODUCT.OUT_OF_STOCK_THRESHOLD;
  }

  /**
   * Check if product has low stock
   * @param stockQuantity - Current stock quantity
   * @returns true if low stock
   */
  isLowStock(stockQuantity: number): boolean {
    return stockQuantity > 0 && stockQuantity < PRODUCT.LOW_STOCK_THRESHOLD;
  }

  /**
   * Get stock icon
   * @param stockQuantity - Current stock quantity
   * @returns Icon class
   */
  getStockIcon(stockQuantity: number): string {
    if (this.isOutOfStock(stockQuantity)) return 'pi pi-times-circle';
    if (this.isLowStock(stockQuantity)) return 'pi pi-exclamation-triangle';
    return 'pi pi-check-circle';
  }
}