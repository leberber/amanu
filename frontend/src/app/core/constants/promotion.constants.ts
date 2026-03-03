/**
 * Promotion-related constants
 * Contains promotion statuses, types, and configurations
 */

// Promotion Status
export const PROMOTION_STATUS = {
  ACTIVE: 'active',
  SCHEDULED: 'scheduled',
  EXPIRED: 'expired',
  INACTIVE: 'inactive'
} as const;

// Type for promotion status
export type PromotionStatusType = typeof PROMOTION_STATUS[keyof typeof PROMOTION_STATUS];

// Discount Types
export const DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const;
export type DiscountType = typeof DISCOUNT_TYPES[number];

// Scope Types
export const SCOPE_TYPES = ['global', 'category', 'brand', 'product'] as const;
export type ScopeType = typeof SCOPE_TYPES[number];

// Scope display labels (translation keys)
export const SCOPE_LABELS: Record<ScopeType, string> = {
  global: 'promotions_page.scope.global',
  category: 'promotions_page.scope.category',
  brand: 'promotions_page.scope.brand',
  product: 'promotions_page.scope.product'
};

// Scope tag severities for PrimeNG Tag component
export const SCOPE_SEVERITIES: Record<ScopeType, 'success' | 'info' | 'warn' | 'secondary'> = {
  global: 'success',
  category: 'info',
  brand: 'warn',
  product: 'secondary'
};

// Promotion Form Defaults and Limits
// Note: Using explicit number types for values that may be assigned to signals
export const PROMOTION_DEFAULTS = {
  DISCOUNT_TYPE: DISCOUNT_TYPES[0],
  SCOPE: SCOPE_TYPES[0],
  DISCOUNT_VALUE: 10 as number,
  MIN_DISCOUNT: 0.01 as number,
  MIN_USAGE_LIMIT: 1 as number,
  MAX_PERCENTAGE: 100 as number,
  MAX_FIXED_AMOUNT: 999999 as number
};
