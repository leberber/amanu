/**
 * Order-related constants
 * Contains order statuses, payment methods, shipping, and status configurations
 */

// Order Status Values
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
} as const;

// Order Status Configuration
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

// Timeline Colors (for order status timeline)
// Derived from ORDER_STATUS_CONFIG for consistency
export const TIMELINE_COLORS = {
  PLACED: '#607D8B',  // Initial order placed - gray
  PENDING: ORDER_STATUS_CONFIG[ORDER_STATUS.PENDING].color,
  CONFIRMED: ORDER_STATUS_CONFIG[ORDER_STATUS.CONFIRMED].color,
  SHIPPED: ORDER_STATUS_CONFIG[ORDER_STATUS.SHIPPED].color,
  DELIVERED: ORDER_STATUS_CONFIG[ORDER_STATUS.DELIVERED].color,
  CANCELLED: ORDER_STATUS_CONFIG[ORDER_STATUS.CANCELLED].color
} as const;

// Status Severity Mapping (for PrimeNG)
// Derived from ORDER_STATUS_CONFIG for consistency
export const STATUS_SEVERITY = {
  [ORDER_STATUS.PENDING]: ORDER_STATUS_CONFIG[ORDER_STATUS.PENDING].severity,
  [ORDER_STATUS.CONFIRMED]: ORDER_STATUS_CONFIG[ORDER_STATUS.CONFIRMED].severity,
  [ORDER_STATUS.SHIPPED]: ORDER_STATUS_CONFIG[ORDER_STATUS.SHIPPED].severity,
  [ORDER_STATUS.DELIVERED]: ORDER_STATUS_CONFIG[ORDER_STATUS.DELIVERED].severity,
  [ORDER_STATUS.CANCELLED]: ORDER_STATUS_CONFIG[ORDER_STATUS.CANCELLED].severity
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer'
} as const;

// Payment Status (for tracking payment state)
export const PAYMENT_STATUS = {
  PAID: 'paid',
  PENDING: 'pending',
  FAILED: 'failed',
  REFUNDED: 'refunded'
} as const;

// Shipping
export const SHIPPING = {
  DEFAULT_COST: 0,
  FREE_SHIPPING_THRESHOLD: 0, // Free shipping always (set higher value to enable threshold)
  STANDARD_COST: 500 // DZD - used if free shipping threshold not met
} as const;
