/**
 * UI-related constants
 * Contains animation durations, UI delays, skeleton counts, and display settings
 */

// Animation Durations (milliseconds)
export const ANIMATION = {
  FAST: 200,
  NORMAL: 300,
  SLOW: 500,
  VERY_SLOW: 1000,
  STAGGER_DELAY: 50,
  HIGHLIGHT_DELAY: 100,
  HIGHLIGHT_DURATION: 800
} as const;

// UI Delays (milliseconds) - for user feedback before navigation
export const UI_DELAY = {
  TOAST_BEFORE_NAVIGATE: 1500,  // Time for user to read success toast
  TOAST_BEFORE_REDIRECT: 2000   // Longer delay for important messages
} as const;

// UI Constants
export const UI = {
  SKELETON_GRID_COUNT: 8,
  SKELETON_LIST_COUNT: 6,
  SKELETON_TABLE_ROWS: 5,
  SKELETON_MOBILE_ROWS: 6,
  SKELETON_SIDEBAR_ITEMS: 3,
  SCROLL_THRESHOLD: 50,
  FOCUS_DELAY: 100,
  TABLE_INIT_DELAY: 100
} as const;

// Date/Time Formats
export const DATETIME = {
  DEFAULT_DATE_FORMAT: 'DD/MM/YYYY',
  DEFAULT_TIME_FORMAT: 'HH:mm',
  DEFAULT_DATETIME_FORMAT: 'DD/MM/YYYY HH:mm',
  LOCALE: 'en-US'
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  MAX_FILES: 10
} as const;
