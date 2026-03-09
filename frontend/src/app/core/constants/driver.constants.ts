/**
 * Driver-related constants
 * Contains driver statuses, vehicle types, and configurations
 */

// Driver Status Values
export const DRIVER_STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
  SUSPENDED: 'suspended'
} as const;

export type DriverStatus = typeof DRIVER_STATUS[keyof typeof DRIVER_STATUS];

// Driver Status Configuration
export const DRIVER_STATUS_CONFIG = {
  [DRIVER_STATUS.AVAILABLE]: {
    icon: 'pi pi-check-circle',
    severity: 'success' as const,
    color: '#22c55e',
    label: 'driver.status.available'
  },
  [DRIVER_STATUS.BUSY]: {
    icon: 'pi pi-truck',
    severity: 'info' as const,
    color: '#3b82f6',
    label: 'driver.status.busy'
  },
  [DRIVER_STATUS.OFFLINE]: {
    icon: 'pi pi-minus-circle',
    severity: 'secondary' as const,
    color: '#6b7280',
    label: 'driver.status.offline'
  },
  [DRIVER_STATUS.SUSPENDED]: {
    icon: 'pi pi-ban',
    severity: 'danger' as const,
    color: '#ef4444',
    label: 'driver.status.suspended'
  }
} as const;

// Vehicle Types
export const VEHICLE_TYPE = {
  TRUCK: 'truck',
  VAN: 'van',
  MINI_VAN: 'mini_van'
} as const;

export type VehicleType = typeof VEHICLE_TYPE[keyof typeof VEHICLE_TYPE];

// Vehicle Type Configuration
export const VEHICLE_TYPE_CONFIG = {
  [VEHICLE_TYPE.TRUCK]: {
    icon: 'pi pi-truck',
    label: 'driver.vehicle.truck'
  },
  [VEHICLE_TYPE.VAN]: {
    icon: 'pi pi-car',
    label: 'driver.vehicle.van'
  },
  [VEHICLE_TYPE.MINI_VAN]: {
    icon: 'pi pi-car',
    label: 'driver.vehicle.mini_van'
  }
} as const;

// Trip Actions
export const TRIP_ACTION = {
  ACCEPT: 'accept',
  PICKUP: 'pickup',
  START_DELIVERY: 'start-delivery',
  COMPLETE: 'complete',
  CANCEL: 'cancel'
} as const;

export type TripAction = typeof TRIP_ACTION[keyof typeof TRIP_ACTION];

// Trip Action Configuration
export const TRIP_ACTION_CONFIG = {
  [TRIP_ACTION.ACCEPT]: {
    icon: 'pi pi-check',
    label: 'driver.action.accept',
    severity: 'success' as const
  },
  [TRIP_ACTION.PICKUP]: {
    icon: 'pi pi-box',
    label: 'driver.action.pickup',
    severity: 'info' as const
  },
  [TRIP_ACTION.START_DELIVERY]: {
    icon: 'pi pi-truck',
    label: 'driver.action.start_delivery',
    severity: 'info' as const
  },
  [TRIP_ACTION.COMPLETE]: {
    icon: 'pi pi-check-square',
    label: 'driver.action.complete',
    severity: 'success' as const
  },
  [TRIP_ACTION.CANCEL]: {
    icon: 'pi pi-times',
    label: 'driver.action.cancel',
    severity: 'danger' as const
  }
} as const;

// Default Configuration Values
export const DRIVER_DEFAULTS = {
  MAX_ACTIVE_ORDERS: 3,
  ASSIGNMENT_TIMEOUT_MINUTES: 30,
  MAX_CANCELLATIONS_PER_PERIOD: 3,
  CANCELLATION_PERIOD_DAYS: 7
} as const;
