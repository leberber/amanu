/**
 * Order-related constants
 * Contains order statuses, payment methods, shipping, and status configurations
 */

// Order Status Values
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  ASSIGNED: 'assigned',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  READY: 'ready',
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
    color: '#c2410c',
    bgColor: '#fff7ed',
    label: 'order.status.pending'
  },
  [ORDER_STATUS.CONFIRMED]: {
    icon: 'pi pi-check-circle',
    iconClass: 'pi-check-circle',
    severity: 'info' as const,
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    label: 'order.status.confirmed'
  },
  [ORDER_STATUS.ASSIGNED]: {
    icon: 'pi pi-user',
    iconClass: 'pi-user',
    severity: 'info' as const,
    color: '#6d28d9',
    bgColor: '#f5f3ff',
    label: 'order.status.assigned'
  },
  [ORDER_STATUS.PICKED_UP]: {
    icon: 'pi pi-box',
    iconClass: 'pi-box',
    severity: 'info' as const,
    color: '#92400e',
    bgColor: '#fef3c7',
    label: 'order.status.picked_up'
  },
  [ORDER_STATUS.IN_TRANSIT]: {
    icon: 'pi pi-truck',
    iconClass: 'pi-truck',
    severity: 'info' as const,
    color: '#4338ca',
    bgColor: '#eef2ff',
    label: 'order.status.in_transit'
  },
  [ORDER_STATUS.READY]: {
    icon: 'pi pi-inbox',
    iconClass: 'pi-inbox',
    severity: 'success' as const,
    color: '#047857',
    bgColor: '#ecfdf5',
    label: 'order.status.ready'
  },
  [ORDER_STATUS.DELIVERED]: {
    icon: 'pi pi-check-square',
    iconClass: 'pi-check-square',
    severity: 'success' as const,
    color: '#15803d',
    bgColor: '#f0fdf4',
    label: 'order.status.delivered'
  },
  [ORDER_STATUS.CANCELLED]: {
    icon: 'pi pi-times-circle',
    iconClass: 'pi-times-circle',
    severity: 'danger' as const,
    color: '#b91c1c',
    bgColor: '#fef2f2',
    label: 'order.status.cancelled'
  }
} as const;

// Brand color palette for PDF rendering — each brand gets a distinct color
export const BRAND_COLOR_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: '#eff6ff', text: '#1d4ed8' }, // blue
  { bg: '#f0fdf4', text: '#15803d' }, // green
  { bg: '#fdf4ff', text: '#7e22ce' }, // purple
  { bg: '#fff7ed', text: '#c2410c' }, // orange
  { bg: '#fef3c7', text: '#92400e' }, // amber
  { bg: '#ecfdf5', text: '#065f46' }, // emerald
  { bg: '#fef2f2', text: '#b91c1c' }, // red
  { bg: '#f0f9ff', text: '#0369a1' }, // sky
  { bg: '#fdf2f8', text: '#9d174d' }, // pink
  { bg: '#fffbeb', text: '#78350f' }, // yellow
];

// Driver Order Status Transitions
// Defines what status a driver can transition an order to from the current status
export const DRIVER_ORDER_TRANSITIONS: Record<string, string | null> = {
  [ORDER_STATUS.ASSIGNED]: ORDER_STATUS.PICKED_UP,
  [ORDER_STATUS.PICKED_UP]: ORDER_STATUS.IN_TRANSIT,
  [ORDER_STATUS.IN_TRANSIT]: ORDER_STATUS.DELIVERED,
  [ORDER_STATUS.DELIVERED]: null // Final state
} as const;

// Timeline Colors (for order status timeline)
// Derived from ORDER_STATUS_CONFIG for consistency
export const TIMELINE_COLORS = {
  PLACED: '#607D8B',  // Initial order placed - gray
  PENDING: ORDER_STATUS_CONFIG[ORDER_STATUS.PENDING].color,
  CONFIRMED: ORDER_STATUS_CONFIG[ORDER_STATUS.CONFIRMED].color,
  ASSIGNED: ORDER_STATUS_CONFIG[ORDER_STATUS.ASSIGNED].color,
  PICKED_UP: ORDER_STATUS_CONFIG[ORDER_STATUS.PICKED_UP].color,
  IN_TRANSIT: ORDER_STATUS_CONFIG[ORDER_STATUS.IN_TRANSIT].color,
  READY: ORDER_STATUS_CONFIG[ORDER_STATUS.READY].color,
  DELIVERED: ORDER_STATUS_CONFIG[ORDER_STATUS.DELIVERED].color,
  CANCELLED: ORDER_STATUS_CONFIG[ORDER_STATUS.CANCELLED].color
} as const;

// Status Severity Mapping (for PrimeNG)
// Derived from ORDER_STATUS_CONFIG for consistency
export const STATUS_SEVERITY = {
  [ORDER_STATUS.PENDING]: ORDER_STATUS_CONFIG[ORDER_STATUS.PENDING].severity,
  [ORDER_STATUS.CONFIRMED]: ORDER_STATUS_CONFIG[ORDER_STATUS.CONFIRMED].severity,
  [ORDER_STATUS.ASSIGNED]: ORDER_STATUS_CONFIG[ORDER_STATUS.ASSIGNED].severity,
  [ORDER_STATUS.PICKED_UP]: ORDER_STATUS_CONFIG[ORDER_STATUS.PICKED_UP].severity,
  [ORDER_STATUS.IN_TRANSIT]: ORDER_STATUS_CONFIG[ORDER_STATUS.IN_TRANSIT].severity,
  [ORDER_STATUS.READY]: ORDER_STATUS_CONFIG[ORDER_STATUS.READY].severity,
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
