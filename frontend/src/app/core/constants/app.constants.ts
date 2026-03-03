/**
 * Core application constants
 * Contains app-level defaults, storage keys, breakpoints, pagination, and search settings
 */

// Application Defaults
export const DEFAULTS = {
  LANGUAGE: 'en',
  CURRENCY: 'DZD',
  THEME: 'light',
  PAGE_TITLE: 'AgroClik - Wholesale Food Platform',
  PLACEHOLDER_IMAGE: 'assets/images/product-placeholder.png'
} as const;

// Local/Session Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user',
  SESSION_EXPIRED: 'session_expired',
  LANGUAGE: 'selected-language',
  CURRENCY: 'selected-currency',
  THEME: 'app_theme',
  CART: 'fresh_produce_cart',
  CART_PROMO: 'fresh_produce_promo',
  PREFERENCES: 'user_preferences',
  HAS_SEEN_ONBOARDING: 'has_seen_onboarding'
} as const;

// Layout Breakpoints (pixels)
export const BREAKPOINTS = {
  XS: 0,
  SM: 576,
  MD: 768,
  LG: 992,
  XL: 1200,
  XXL: 1400
} as const;

// Pagination (consolidated from pagination.constants.ts)
// Note: Not using 'as const' to allow numeric values to be assignable
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10 as number,
  DEFAULT_PAGE: 1 as number,
  DEFAULT_NOTIFICATION_LIMIT: 20 as number,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100] as number[],
  ADMIN_PAGE_SIZE_OPTIONS: [10, 20, 25, 50] as number[],
  USER_PAGE_SIZE_OPTIONS: [5, 10, 25] as number[],
  MAX_PAGE_SIZE: 100 as number,
  FETCH_ALL_LIMIT: 1000 as number  // Used when fetching all items without pagination
};

// Search and Filter
export const SEARCH = {
  DEBOUNCE_TIME: 300, // milliseconds
  MIN_SEARCH_LENGTH: 2,
  MAX_SEARCH_LENGTH: 100
} as const;
