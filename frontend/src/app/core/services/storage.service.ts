import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '../constants/app.constants';

/**
 * Centralized service for localStorage operations.
 * Provides type-safe methods with built-in error handling.
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  /**
   * Get a string value from localStorage
   */
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * Set a string value in localStorage
   */
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage full or unavailable
    }
  }

  /**
   * Remove a value from localStorage
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Get and parse a JSON value from localStorage
   */
  getJson<T>(key: string, defaultValue: T): T {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Stringify and set a JSON value in localStorage
   */
  setJson<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable
    }
  }

  /**
   * Check if a key exists in localStorage
   */
  has(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch {
      // Storage unavailable
    }
  }

  // ============================================
  // Typed convenience methods for common keys
  // ============================================

  // Auth token
  getAuthToken(): string | null {
    return this.get(STORAGE_KEYS.AUTH_TOKEN);
  }

  setAuthToken(token: string): void {
    this.set(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  removeAuthToken(): void {
    this.remove(STORAGE_KEYS.AUTH_TOKEN);
  }

  // User data
  getUser<T>(): T | null {
    return this.getJson(STORAGE_KEYS.USER_DATA, null as T | null);
  }

  setUser<T>(user: T): void {
    this.setJson(STORAGE_KEYS.USER_DATA, user);
  }

  removeUser(): void {
    this.remove(STORAGE_KEYS.USER_DATA);
  }

  // Language
  getLanguage(): string | null {
    return this.get(STORAGE_KEYS.LANGUAGE);
  }

  setLanguage(lang: string): void {
    this.set(STORAGE_KEYS.LANGUAGE, lang);
  }

  // Currency
  getCurrency(): string | null {
    return this.get(STORAGE_KEYS.CURRENCY);
  }

  setCurrency(currency: string): void {
    this.set(STORAGE_KEYS.CURRENCY, currency);
  }

  // Cart
  getCart<T>(): T[] {
    return this.getJson(STORAGE_KEYS.CART, [] as T[]);
  }

  setCart<T>(items: T[]): void {
    this.setJson(STORAGE_KEYS.CART, items);
  }

  // Cart promo
  getCartPromo<T>(): T | null {
    return this.getJson(STORAGE_KEYS.CART_PROMO, null as T | null);
  }

  setCartPromo<T>(promo: T | null): void {
    if (promo) {
      this.setJson(STORAGE_KEYS.CART_PROMO, promo);
    } else {
      this.remove(STORAGE_KEYS.CART_PROMO);
    }
  }

  // Onboarding
  hasSeenOnboarding(): boolean {
    return this.get(STORAGE_KEYS.HAS_SEEN_ONBOARDING) === 'true';
  }

  markOnboardingSeen(): void {
    this.set(STORAGE_KEYS.HAS_SEEN_ONBOARDING, 'true');
  }

  // Product view mode (stored in preferences)
  getProductViewMode(): 'grid' | 'list' {
    const prefs = this.getJson<{ productViewMode?: string }>(STORAGE_KEYS.PREFERENCES, {});
    return prefs.productViewMode === 'list' ? 'list' : 'grid';
  }

  setProductViewMode(mode: 'grid' | 'list'): void {
    const prefs = this.getJson<Record<string, unknown>>(STORAGE_KEYS.PREFERENCES, {});
    prefs['productViewMode'] = mode;
    this.setJson(STORAGE_KEYS.PREFERENCES, prefs);
  }

  // Sidebar collapsed state (stored in preferences)
  getSidebarCollapsed(): boolean {
    const prefs = this.getJson<{ sidebarCollapsed?: boolean }>(STORAGE_KEYS.PREFERENCES, {});
    return prefs.sidebarCollapsed === true;
  }

  setSidebarCollapsed(collapsed: boolean): void {
    const prefs = this.getJson<Record<string, unknown>>(STORAGE_KEYS.PREFERENCES, {});
    prefs['sidebarCollapsed'] = collapsed;
    this.setJson(STORAGE_KEYS.PREFERENCES, prefs);
  }

  // Clear auth-related data on logout
  clearAuthData(): void {
    this.removeAuthToken();
    this.removeUser();
  }

  // Session expired flag
  setSessionExpired(): void {
    this.set(STORAGE_KEYS.SESSION_EXPIRED, 'true');
  }

  isSessionExpired(): boolean {
    return this.get(STORAGE_KEYS.SESSION_EXPIRED) === 'true';
  }

  clearSessionExpired(): void {
    this.remove(STORAGE_KEYS.SESSION_EXPIRED);
  }
}
