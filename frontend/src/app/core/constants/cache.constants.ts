/**
 * Cache-related constants
 * Contains TTL (Time-To-Live) values for cached data
 * All values are in milliseconds
 */

// Cache TTL values (milliseconds)
export const CACHE_TTL = {
  /** Volume discounts cache - 20 minutes */
  VOLUME_DISCOUNTS: 20 * 60 * 1000,

  /** Promotions cache - 15 minutes */
  PROMOTIONS: 15 * 60 * 1000,

  /** Products cache - 10 minutes */
  PRODUCTS: 10 * 60 * 1000,

  /** Categories cache - 30 minutes (rarely changes) */
  CATEGORIES: 30 * 60 * 1000,

  /** Brands cache - 30 minutes (rarely changes) */
  BRANDS: 30 * 60 * 1000
} as const;

// Helper to check if cache is expired
export function isCacheExpired(lastFetchTime: number | null, ttl: number): boolean {
  if (!lastFetchTime) return true;
  return Date.now() - lastFetchTime > ttl;
}
