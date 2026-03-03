import { PRODUCT } from '../../core/constants/product.constants';

/**
 * Stock utility functions to avoid repeated logic across components
 */

export interface StockCheckable {
  stock_quantity?: number;
}

/**
 * Check if an item is out of stock
 */
export function isOutOfStock(item: StockCheckable | null | undefined): boolean {
  if (!item) return true;
  if (item.stock_quantity === undefined) return false;
  return item.stock_quantity <= 0;
}

/**
 * Check if an item has low stock
 */
export function isLowStock(
  item: StockCheckable | null | undefined,
  threshold: number = PRODUCT.LOW_STOCK_THRESHOLD
): boolean {
  if (!item || item.stock_quantity === undefined) return false;
  return item.stock_quantity > 0 && item.stock_quantity < threshold;
}

/**
 * Get stock status string for an item
 */
export function getStockStatus(
  item: StockCheckable | null | undefined
): 'out_of_stock' | 'low_stock' | 'in_stock' | 'unknown' {
  if (!item || item.stock_quantity === undefined) return 'unknown';
  if (isOutOfStock(item)) return 'out_of_stock';
  if (isLowStock(item)) return 'low_stock';
  return 'in_stock';
}
