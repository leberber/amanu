import { CurrencyService } from '../../core/services/currency.service';

/**
 * Discount utility functions to avoid repeated logic across components
 */

export interface PromotionInfo {
  discount_type: 'percentage' | 'fixed' | 'fixed_amount';
  discount_value: number;
  discounted_price?: number;
}

export interface VolumeDiscountInfo {
  discount_type: 'percentage' | 'fixed_amount' | 'free_units';
  discount_value: number;
  min_quantity: number; // In cartons
}

export interface VolumeDiscountCalculation {
  qualifies: boolean;
  sets: number;
  savedAmount: number;
  freeCartons: number;
  freeUnits: number;
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

// ============================================
// Volume Discount Calculation Utilities
// ============================================

/**
 * Calculate volume discount for given quantity and discount info
 * @param cartonsOrdered Number of cartons ordered
 * @param discount Volume discount configuration
 * @param unitPrice Price per unit (piece)
 * @param piecesPerBox Pieces per carton
 */
export function calculateVolumeDiscount(
  cartonsOrdered: number,
  discount: VolumeDiscountInfo,
  unitPrice: number,
  piecesPerBox: number
): VolumeDiscountCalculation {
  const qualifies = cartonsOrdered >= discount.min_quantity;

  if (!qualifies) {
    return { qualifies: false, sets: 0, savedAmount: 0, freeCartons: 0, freeUnits: 0 };
  }

  const sets = Math.floor(cartonsOrdered / discount.min_quantity);

  switch (discount.discount_type) {
    case 'percentage': {
      const qualifyingPieces = sets * discount.min_quantity * piecesPerBox;
      const qualifyingPrice = qualifyingPieces * unitPrice;
      const savedAmount = qualifyingPrice * (discount.discount_value / 100);
      return { qualifies: true, sets, savedAmount, freeCartons: 0, freeUnits: 0 };
    }

    case 'fixed_amount': {
      const savedAmount = sets * discount.discount_value;
      return { qualifies: true, sets, savedAmount, freeCartons: 0, freeUnits: 0 };
    }

    case 'free_units': {
      const freeCartons = sets * discount.discount_value;
      const freeUnits = freeCartons * piecesPerBox;
      const savedAmount = freeUnits * unitPrice;
      return { qualifies: true, sets, savedAmount, freeCartons, freeUnits };
    }

    default:
      return { qualifies: false, sets: 0, savedAmount: 0, freeCartons: 0, freeUnits: 0 };
  }
}

/**
 * Calculate original price for display (including free units value for free_units discount)
 */
export function calculateOriginalPriceWithFree(
  orderedQuantity: number,
  unitPrice: number,
  piecesPerBox: number,
  freeCartons: number
): number {
  const orderedCartons = Math.floor(orderedQuantity / piecesPerBox);
  const totalCartons = orderedCartons + freeCartons;
  return totalCartons * piecesPerBox * unitPrice;
}

/**
 * Get total cartons including free ones
 */
export function getTotalCartonsWithFree(
  orderedQuantity: number,
  piecesPerBox: number,
  freeCartons: number
): number {
  const orderedCartons = Math.floor(orderedQuantity / piecesPerBox);
  return orderedCartons + freeCartons;
}
