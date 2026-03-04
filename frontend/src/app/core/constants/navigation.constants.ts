/**
 * Navigation configuration constants
 * Centralized navigation items to avoid duplication across components
 */

import { ROUTES } from './routes.constants';

export interface AdminNavItem {
  labelKey: string;
  icon: string;
  route: string;
  adminOnly?: boolean;  // Only visible to admin role
  staffOnly?: boolean;  // Visible to admin and staff roles
}

/**
 * Admin navigation items configuration
 * Used by SidebarComponent and MobileAdminMenuComponent
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    labelKey: 'admin.navigation.dashboard',
    icon: 'pi pi-chart-bar',
    route: ROUTES.ADMIN.DASHBOARD,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.orders',
    icon: 'pi pi-list',
    route: ROUTES.ADMIN.ORDERS,
    staffOnly: true
  },
  {
    labelKey: 'admin.navigation.products',
    icon: 'pi pi-tag',
    route: ROUTES.ADMIN.PRODUCTS,
    staffOnly: true
  },
  {
    labelKey: 'admin.navigation.categories',
    icon: 'pi pi-tags',
    route: ROUTES.ADMIN.CATEGORIES,
    staffOnly: true
  },
  {
    labelKey: 'admin.navigation.brands',
    icon: 'pi pi-building',
    route: ROUTES.ADMIN.BRANDS,
    staffOnly: true
  },
  {
    labelKey: 'admin.navigation.promotions',
    icon: 'pi pi-percentage',
    route: ROUTES.ADMIN.PROMOTIONS,
    staffOnly: true
  },
  {
    labelKey: 'admin.navigation.users',
    icon: 'pi pi-users',
    route: ROUTES.ADMIN.USERS,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.user_groups',
    icon: 'pi pi-th-large',
    route: ROUTES.ADMIN.USER_GROUPS,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.notifications',
    icon: 'pi pi-bell',
    route: ROUTES.ADMIN.NOTIFICATIONS,
    adminOnly: true
  }
];
