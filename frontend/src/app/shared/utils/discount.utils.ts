import { CurrencyService } from '../../core/services/currency.service';

/**
 * Discount utility functions to avoid repeated logic across components
 */

export interface PromotionInfo {
  discount_type: 'percentage' | 'fixed' | 'fixed_amount';
  discount_value: number;
  discounted_price?: number;
}

/**
 * Format discount label for display (e.g., "-10%" or "-100 DZD")
 * For fixed amount discounts, multiplies by piecesPerBox to show per-carton savings
 */
export function formatDiscountLabel(
  promotion: PromotionInfo | null | undefined,
  currencyService: CurrencyService,
  piecesPerBox: number = 1
): string {
  if (!promotion) return '';

  if (promotion.discount_type === 'percentage') {
    return `-${promotion.discount_value}%`;
  }

  const totalDiscount = promotion.discount_value * piecesPerBox;
  return `-${currencyService.formatCurrency(totalDiscount)}`;
}

/**
 * Get effective price after discount
 */
export function getEffectivePrice(
  originalPrice: number,
  promotion: PromotionInfo | null | undefined
): number {
  if (!promotion) return originalPrice;
  return promotion.discounted_price ?? originalPrice;
}

/**
 * Check if a product has an active promotion
 */
export function hasPromotion(promotion: PromotionInfo | null | undefined): boolean {
  return promotion != null;
}
