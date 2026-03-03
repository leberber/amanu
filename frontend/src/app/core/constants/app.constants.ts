/**
 * Application-wide constants to avoid magic numbers and strings
 */

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  DEFAULT_PAGE: 1,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  ADMIN_PAGE_SIZE_OPTIONS: [10, 25, 50],
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
  QUANTITY_STEP: 1,
  QUANTITY_INCREMENT: 5,
  LOW_STOCK_THRESHOLD: 10,
  MEDIUM_STOCK_THRESHOLD: 50,
  OUT_OF_STOCK_THRESHOLD: 0,
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  IMAGE_ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  // Grid display settings
  GRID_MAX_HEIGHT: 300,
  GRID_MIN_COLUMN_WIDTH: 60,
  // Content limits
  MAX_DESCRIPTION_LENGTH: 200,
  DEFAULT_DESCRIPTION: 'Quality wholesale products for your business.'
} as const;

// Order Status
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
} as const;

// Centralized Order Status Configuration
// Use this everywhere for consistent icons, colors, and severities
// Colors match CSS variables in _colors.scss: --color-pending, --color-confirmed, etc.
export const ORDER_STATUS_CONFIG = {
  [ORDER_STATUS.PENDING]: {
    icon: 'pi pi-clock',
    iconClass: 'pi-clock',
    severity: 'warn' as const,
    color: '#f57c00'  // Orange - matches --color-pending
  },
  [ORDER_STATUS.CONFIRMED]: {
    icon: 'pi pi-check-circle',
    iconClass: 'pi-check-circle',
    severity: 'info' as const,
    color: '#1976d2'  // Blue - matches --color-confirmed
  },
  [ORDER_STATUS.SHIPPED]: {
    icon: 'pi pi-truck',
    iconClass: 'pi-truck',
    severity: 'info' as const,
    color: '#512da8'  // Purple - matches --color-shipped
  },
  [ORDER_STATUS.DELIVERED]: {
    icon: 'pi pi-check-square',
    iconClass: 'pi-check-square',
    severity: 'success' as const,
    color: '#2e7d32'  // Dark green - matches --color-delivered
  },
  [ORDER_STATUS.CANCELLED]: {
    icon: 'pi pi-times-circle',
    iconClass: 'pi-times-circle',
    severity: 'danger' as const,
    color: '#d32f2f'  // Red - matches --color-cancelled
  }
} as const;

// Notification Type Configuration
// Used for user notification icons and colors
export const NOTIFICATION_TYPE_CONFIG = {
  order_confirmed: {
    icon: 'pi pi-check-circle',
    severity: 'info' as const
  },
  order_shipped: {
    icon: 'pi pi-truck',
    severity: 'info' as const
  },
  order_delivered: {
    icon: 'pi pi-check-square',
    severity: 'success' as const
  },
  order_cancelled: {
    icon: 'pi pi-times-circle',
    severity: 'danger' as const
  },
  payment_received: {
    icon: 'pi pi-wallet',
    severity: 'success' as const
  },
  promotion: {
    icon: 'pi pi-percentage',
    severity: 'warn' as const
  },
  system: {
    icon: 'pi pi-info-circle',
    severity: 'secondary' as const
  }
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

// Shipping
export const SHIPPING = {
  DEFAULT_COST: 0,
  FREE_SHIPPING_THRESHOLD: 0, // Free shipping always (set higher value to enable threshold)
  STANDARD_COST: 500 // DZD - used if free shipping threshold not met
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
  PAGE_TITLE: 'AgroClik - Wholesale Food Platform',
  PLACEHOLDER_IMAGE: 'assets/images/product-placeholder.png'
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

// Timeline Colors (for order status timeline)
// Now derived from ORDER_STATUS_CONFIG for consistency
export const TIMELINE_COLORS = {
  PLACED: '#607D8B',  // Initial order placed - gray
  PENDING: ORDER_STATUS_CONFIG[ORDER_STATUS.PENDING].color,
  CONFIRMED: ORDER_STATUS_CONFIG[ORDER_STATUS.CONFIRMED].color,
  SHIPPED: ORDER_STATUS_CONFIG[ORDER_STATUS.SHIPPED].color,
  DELIVERED: ORDER_STATUS_CONFIG[ORDER_STATUS.DELIVERED].color,
  CANCELLED: ORDER_STATUS_CONFIG[ORDER_STATUS.CANCELLED].color
} as const;

// Status Severity Mapping (for PrimeNG)
// Now derived from ORDER_STATUS_CONFIG for consistency
export const STATUS_SEVERITY = {
  [ORDER_STATUS.PENDING]: ORDER_STATUS_CONFIG[ORDER_STATUS.PENDING].severity,
  [ORDER_STATUS.CONFIRMED]: ORDER_STATUS_CONFIG[ORDER_STATUS.CONFIRMED].severity,
  [ORDER_STATUS.SHIPPED]: ORDER_STATUS_CONFIG[ORDER_STATUS.SHIPPED].severity,
  [ORDER_STATUS.DELIVERED]: ORDER_STATUS_CONFIG[ORDER_STATUS.DELIVERED].severity,
  [ORDER_STATUS.CANCELLED]: ORDER_STATUS_CONFIG[ORDER_STATUS.CANCELLED].severity
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

// Promotion Status
export const PROMOTION_STATUS = {
  ACTIVE: 'active',
  SCHEDULED: 'scheduled',
  EXPIRED: 'expired',
  INACTIVE: 'inactive'
} as const;

// Payment Status (for tracking payment state)
export const PAYMENT_STATUS = {
  PAID: 'paid',
  PENDING: 'pending',
  FAILED: 'failed',
  REFUNDED: 'refunded'
} as const;