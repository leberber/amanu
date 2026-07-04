/**
 * User-related constants
 * Contains user roles and user-specific configurations
 */

// User Roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  STAFF: 'staff',
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant'
} as const;

// Type for user roles
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
