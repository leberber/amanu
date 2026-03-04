import { Injectable, signal, computed, inject } from '@angular/core';
import { STORAGE_KEYS, DEFAULTS } from '../constants/app.constants';
import { StorageService } from './storage.service';

export type ViewMode = 'grid' | 'list';

export interface UserPreferences {
  productViewMode: ViewMode;
  // Add future preferences here
  // theme: 'light' | 'dark' | 'system';
  // notificationsEnabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  productViewMode: DEFAULTS.VIEW_MODE
};

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private readonly storage = inject(StorageService);
  private preferences = signal<UserPreferences>(this.loadPreferences());

  // Expose individual preferences as computed signals for easy access
  readonly productViewMode = computed(() => this.preferences().productViewMode);

  // Get all preferences
  readonly allPreferences = computed(() => this.preferences());

  constructor() {
    // Set default view mode if no saved preference
    if (!this.storage.has(STORAGE_KEYS.PREFERENCES)) {
      this.setProductViewMode(DEFAULTS.VIEW_MODE);
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
    const stored = this.storage.getJson<Partial<UserPreferences>>(STORAGE_KEYS.PREFERENCES, {});
    return { ...DEFAULT_PREFERENCES, ...stored };
  }

  private savePreferences(): void {
    this.storage.setJson(STORAGE_KEYS.PREFERENCES, this.preferences());
  }
}
