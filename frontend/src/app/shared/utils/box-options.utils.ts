import { CurrencyService } from '../../core/services/currency.service';
import { PRODUCT } from '../../core/constants/product.constants';

/**
 * Box options utility functions to avoid repeated logic across components
 */

export interface BoxOption {
  boxes: number;
  pieces: number;
  price: number;
  label: string;
}

export interface BoxProduct {
  stock_quantity: number;
  pieces_per_box?: number;
  price: number;
  max_order_cartons?: number | null;
  promotion?: {
    discounted_price?: number;
  } | null;
}

/**
 * Get the effective price for a product (with or without promotion)
 */
function getEffectivePrice(product: BoxProduct): number {
  return product.promotion?.discounted_price ?? product.price;
}

/**
 * Get pieces per box with default fallback
 */
function getPiecesPerBox(product: BoxProduct): number {
  return product.pieces_per_box || PRODUCT.DEFAULT_QUANTITY;
}

/**
 * Calculate maximum available boxes based on stock
 */
function getMaxBoxes(product: BoxProduct): number {
  const piecesPerBox = getPiecesPerBox(product);
  if (piecesPerBox <= 0) return 0;
  return Math.floor(product.stock_quantity / piecesPerBox);
}

/**
 * Generate box options for a product
 */
export function generateBoxOptions(
  product: BoxProduct,
  currencyService: CurrencyService
): BoxOption[] {
  const options: BoxOption[] = [];
  const piecesPerBox = getPiecesPerBox(product);
  const effectivePrice = getEffectivePrice(product);
  const maxBoxes = getMaxBoxes(product);
  const max = product.max_order_cartons != null
    ? Math.min(maxBoxes, product.max_order_cartons)
    : maxBoxes;

  for (let i = 1; i <= max; i++) {
    const pieces = i * piecesPerBox;
    const price = pieces * effectivePrice;
    options.push({
      boxes: i,
      pieces,
      price,
      label: `${i} ${i === 1 ? 'box' : 'boxes'} • ${pieces} pc • ${currencyService.formatCurrency(price)}`
    });
  }

  return options;
}

// getDefaultQuantity is imported from quantity.utils.ts
// Re-export for backwards compatibility
export { getDefaultQuantity } from './quantity.utils';
