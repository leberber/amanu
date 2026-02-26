/**
 * Utility functions for table operations
 * Used by admin list components to avoid code duplication
 */

import { WritableSignal } from '@angular/core';
import { UI } from '../../core/constants/app.constants';

/**
 * Toggle fullscreen mode for table view.
 * Manages body overflow and CSS class for fullscreen styling.
 *
 * @param isFullscreen - Signal to track fullscreen state
 */
export function toggleFullscreen(isFullscreen: WritableSignal<boolean>): void {
  isFullscreen.update(v => !v);
  if (isFullscreen()) {
    document.body.classList.add('fullscreen-active');
    document.body.style.overflow = 'hidden';
  } else {
    document.body.classList.remove('fullscreen-active');
    document.body.style.overflow = '';
  }
}

/**
 * Toggle fullscreen mode for boolean state (non-signal version).
 * Returns the new state.
 *
 * @param currentState - Current fullscreen state
 * @returns New fullscreen state
 */
export function toggleFullscreenBoolean(currentState: boolean): boolean {
  const newState = !currentState;
  if (newState) {
    document.body.classList.add('fullscreen-active');
    document.body.style.overflow = 'hidden';
  } else {
    document.body.classList.remove('fullscreen-active');
    document.body.style.overflow = '';
  }
  return newState;
}

/**
 * Initialize table with delay for smooth animations.
 * Call this after data is loaded.
 *
 * @param tableInitialized - Signal to track table initialization state
 */
export function initializeTable(tableInitialized: WritableSignal<boolean>): void {
  setTimeout(() => tableInitialized.set(true), UI.TABLE_INIT_DELAY);
}
