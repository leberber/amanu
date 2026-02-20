import { Injectable, signal, computed } from '@angular/core';
import { STORAGE_KEYS, BREAKPOINTS } from '../constants/app.constants';

export type ViewMode = 'grid' | 'list';

export interface UserPreferences {
  productViewMode: ViewMode;
  // Add future preferences here
  // theme: 'light' | 'dark' | 'system';
  // notificationsEnabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  productViewMode: 'list'
};

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private preferences = signal<UserPreferences>(this.loadPreferences());

  // Expose individual preferences as computed signals for easy access
  readonly productViewMode = computed(() => this.preferences().productViewMode);

  // Get all preferences
  readonly allPreferences = computed(() => this.preferences());

  constructor() {
    // Set default based on screen size if no saved preference
    if (!localStorage.getItem(STORAGE_KEYS.PREFERENCES)) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.MD;
      this.setProductViewMode(isMobile ? 'list' : 'grid');
    }
  }

  setProductViewMode(mode: ViewMode): void {
    this.updatePreference('productViewMode', mode);
  }

  toggleProductViewMode(): ViewMode {
    const newMode = this.productViewMode() === 'grid' ? 'list' : 'grid';
    this.setProductViewMode(newMode);
    return newMode;
  }

  // Generic method to update any preference
  private updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): void {
    this.preferences.update(prefs => ({
      ...prefs,
      [key]: value
    }));
    this.savePreferences();
  }

  private loadPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_PREFERENCES, ...parsed };
      }
    } catch (e) {
      console.error('Error loading preferences:', e);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  private savePreferences(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(this.preferences()));
    } catch (e) {
      console.error('Error saving preferences:', e);
    }
  }
}
