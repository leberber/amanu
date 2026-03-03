/**
 * Notification-related constants
 * Contains toast durations and notification type configurations
 */

// Toast/Notification Durations (milliseconds)
export const NOTIFICATION = {
  SUCCESS_DURATION: 3000,
  ERROR_DURATION: 5000,
  INFO_DURATION: 4000,
  WARNING_DURATION: 4000,
  DEFAULT_DURATION: 3000
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

// Type for notification types
export type NotificationType = keyof typeof NOTIFICATION_TYPE_CONFIG;
