/**
 * Promotion-related constants
 * Contains promotion statuses and configurations
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
