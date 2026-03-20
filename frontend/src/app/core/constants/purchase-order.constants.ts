/**
 * Purchase Order constants
 * Contains purchase order statuses and status configurations
 */

// Purchase Order Status Values
export const PURCHASE_ORDER_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  CONFIRMED: 'confirmed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
} as const;

export type PurchaseOrderStatusType = typeof PURCHASE_ORDER_STATUS[keyof typeof PURCHASE_ORDER_STATUS];

// Purchase Order Status Configuration
// Use this everywhere for consistent icons, colors, severities, and labels
export const PURCHASE_ORDER_STATUS_CONFIG = {
  [PURCHASE_ORDER_STATUS.DRAFT]: {
    icon: 'pi pi-pencil',
    severity: 'secondary' as const,
    color: '#607D8B',
    label: 'Brouillon'
  },
  [PURCHASE_ORDER_STATUS.SENT]: {
    icon: 'pi pi-send',
    severity: 'info' as const,
    color: '#1976d2',
    label: 'Envoyée'
  },
  [PURCHASE_ORDER_STATUS.CONFIRMED]: {
    icon: 'pi pi-check-circle',
    severity: 'warn' as const,
    color: '#f57c00',
    label: 'Confirmée'
  },
  [PURCHASE_ORDER_STATUS.DELIVERED]: {
    icon: 'pi pi-check',
    severity: 'success' as const,
    color: '#2e7d32',
    label: 'Livrée'
  },
  [PURCHASE_ORDER_STATUS.CANCELLED]: {
    icon: 'pi pi-times-circle',
    severity: 'danger' as const,
    color: '#d32f2f',
    label: 'Annulée'
  }
} as const;

// Status Severity Mapping (for PrimeNG)
export const PURCHASE_ORDER_STATUS_SEVERITY = {
  [PURCHASE_ORDER_STATUS.DRAFT]: PURCHASE_ORDER_STATUS_CONFIG[PURCHASE_ORDER_STATUS.DRAFT].severity,
  [PURCHASE_ORDER_STATUS.SENT]: PURCHASE_ORDER_STATUS_CONFIG[PURCHASE_ORDER_STATUS.SENT].severity,
  [PURCHASE_ORDER_STATUS.CONFIRMED]: PURCHASE_ORDER_STATUS_CONFIG[PURCHASE_ORDER_STATUS.CONFIRMED].severity,
  [PURCHASE_ORDER_STATUS.DELIVERED]: PURCHASE_ORDER_STATUS_CONFIG[PURCHASE_ORDER_STATUS.DELIVERED].severity,
  [PURCHASE_ORDER_STATUS.CANCELLED]: PURCHASE_ORDER_STATUS_CONFIG[PURCHASE_ORDER_STATUS.CANCELLED].severity
} as const;
