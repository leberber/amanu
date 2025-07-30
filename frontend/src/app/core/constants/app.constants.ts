/**
 * Application-wide constants to avoid magic numbers and strings
 */

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  DEFAULT_PAGE: 1,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100
} as const;

// Form Validation
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 20,
  MIN_ADDRESS_LENGTH: 10,
  MAX_ADDRESS_LENGTH: 500,
  EMAIL_PATTERN: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE_PATTERN: /^\+?[0-9\s\-()]+$/
} as const;

// Product Constraints
export const PRODUCT = {
  MIN_PRICE: 0,
  MAX_PRICE: 999999.99,
  MIN_STOCK: 0,
  MAX_STOCK: 999999,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 100,
  DEFAULT_QUANTITY: 1,
  LOW_STOCK_THRESHOLD: 10,
  MEDIUM_STOCK_THRESHOLD: 50,
  OUT_OF_STOCK_THRESHOLD: 0,
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  IMAGE_ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp']
} as const;

// Order Status
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
} as const;

// User Roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
  ADMIN: 'admin'
} as const;

// API Configuration
export const API = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutes
} as const;

// Toast/Notification Durations (milliseconds)
export const NOTIFICATION = {
  SUCCESS_DURATION: 3000,
  ERROR_DURATION: 5000,
  INFO_DURATION: 4000,
  WARNING_DURATION: 4000,
  DEFAULT_DURATION: 3000
} as const;

// Search and Filter
export const SEARCH = {
  DEBOUNCE_TIME: 300, // milliseconds
  MIN_SEARCH_LENGTH: 2,
  MAX_SEARCH_LENGTH: 100
} as const;

// Cart
export const CART = {
  MAX_ITEMS: 50,
  MIN_CHECKOUT_AMOUNT: 0,
  SESSION_STORAGE_KEY: 'cart_items',
  SYNC_INTERVAL: 5000 // 5 seconds
} as const;

// Date/Time
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

// Animation Durations (milliseconds)
export const ANIMATION = {
  FAST: 200,
  NORMAL: 300,
  SLOW: 500,
  VERY_SLOW: 1000
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

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  LANGUAGE: 'app_language',
  THEME: 'app_theme',
  CART: 'cart_data',
  PREFERENCES: 'user_preferences'
} as const;

// Error Codes
export const ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  SERVER_ERROR: 500,
  NETWORK_ERROR: 0
} as const;

// Default Values
export const DEFAULTS = {
  LANGUAGE: 'en',
  CURRENCY: 'DZD',
  THEME: 'light',
  PAGE_TITLE: 'Elsuq - Fresh Produce Marketplace'
} as const;

// Regex Patterns
export const PATTERNS = {
  EMAIL: VALIDATION.EMAIL_PATTERN,
  PHONE: VALIDATION.PHONE_PATTERN,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  NUMERIC: /^[0-9]+$/,
  ALPHABETIC: /^[a-zA-Z]+$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
} as const;

// Status Severity Mapping (for PrimeNG)
export const STATUS_SEVERITY = {
  [ORDER_STATUS.PENDING]: 'warn',
  [ORDER_STATUS.CONFIRMED]: 'info',
  [ORDER_STATUS.SHIPPED]: 'info',
  [ORDER_STATUS.DELIVERED]: 'success',
  [ORDER_STATUS.CANCELLED]: 'danger'
} as const;

// Stock Status
export const STOCK_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock'
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer'
} as const;