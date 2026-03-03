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
  SPLASH_DURATION: 1200,
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
  SKELETON_CART_ITEMS: 3,
  SKELETON_TIMELINE_ITEMS: 2,
  SCROLL_THRESHOLD: 50,
  FOCUS_DELAY: 100,
  TABLE_INIT_DELAY: 100
} as const;

// Date/Time Formats
export const DATETIME = {
  DEFAULT_DATE_FORMAT: 'DD/MM/YYYY',
  DEFAULT_TIME_FORMAT: 'HH:mm',
  DEFAULT_DATETIME_FORMAT: 'DD/MM/YYYY HH:mm',
  PRIMENG_DATE_FORMAT: 'dd/mm/yy',
  LOCALE: 'en-US'
} as const;

// Time Conversion Constants (for date calculations)
export const TIME = {
  MS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  MS_PER_MINUTE: 60 * 1000,
  MS_PER_HOUR: 60 * 60 * 1000,
  MS_PER_DAY: 24 * 60 * 60 * 1000
} as const;

// Time Filter Options (for order/history filtering)
export const TIME_FILTERS = {
  ALL: 'all',
  LAST_7_DAYS: '7days',
  LAST_30_DAYS: '30days',
  LAST_90_DAYS: '90days'
} as const;

export const TIME_FILTER_DAYS: Record<string, number> = {
  '7days': 7,
  '30days': 30,
  '90days': 90
};

// Time filter options for dropdowns/segment controls
export const TIME_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'orders.filters.all' },
  { value: '7days' as const, label: 'orders.filters.last_7_days' },
  { value: '30days' as const, label: 'orders.filters.last_month' },
  { value: '90days' as const, label: 'orders.filters.last_3_months' }
] as const;

// Gesture/Touch Constants
export const GESTURE = {
  SWIPE_THRESHOLD: 50  // Minimum pixels for swipe detection
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  MAX_FILES: 10
} as const;
