/**
 * Cart-related constants
 * Contains shopping cart configurations and limits
 */

// Cart Configuration
export const CART = {
  MAX_ITEMS: 50,
  MIN_CHECKOUT_AMOUNT: 0,
  SESSION_STORAGE_KEY: 'cart_items',
  SYNC_INTERVAL: 5000 // 5 seconds
} as const;
