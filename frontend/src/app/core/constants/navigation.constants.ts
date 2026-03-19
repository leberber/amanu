/**
 * Navigation configuration constants
 * Centralized navigation items to avoid duplication across components
 */

import { ROUTES } from './routes.constants';

/**
 * Routes that should close the mobile drawer permanently when navigated to.
 * For these routes, pressing back will NOT reopen the drawer.
 * Routes NOT in this list will allow the drawer to reopen on back navigation.
 */
export const DRAWER_CLOSE_ROUTES: string[] = [
  ROUTES.PRODUCTS,
  ROUTES.CART,
  ROUTES.ORDERS,
  ROUTES.CHECKOUT,
  ROUTES.ORDER_SUMMARY,
  // Admin routes
  ...Object.values(ROUTES.ADMIN)
];

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
    labelKey: 'admin.navigation.sales_report',
    icon: 'pi pi-chart-line',
    route: ROUTES.ADMIN.SALES_REPORT,
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
    labelKey: 'admin.navigation.users_map',
    icon: 'pi pi-map-marker',
    route: ROUTES.ADMIN.USERS_MAP,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.user_groups',
    icon: 'pi pi-th-large',
    route: ROUTES.ADMIN.USER_GROUPS,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.drivers',
    icon: 'pi pi-car',
    route: ROUTES.ADMIN.DRIVER_MANAGEMENT,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.notifications',
    icon: 'pi pi-bell',
    route: ROUTES.ADMIN.NOTIFICATIONS,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.shipping',
    icon: 'pi pi-truck',
    route: ROUTES.ADMIN.SHIPPING,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.batching',
    icon: 'pi pi-sitemap',
    route: ROUTES.ADMIN.BATCHING,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.stock',
    icon: 'pi pi-box',
    route: ROUTES.ADMIN.STOCK,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.purchase_orders',
    icon: 'pi pi-file-edit',
    route: ROUTES.ADMIN.PURCHASE_ORDERS,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.logs',
    icon: 'pi pi-file',
    route: ROUTES.ADMIN.LOGS,
    adminOnly: true
  },
  {
    labelKey: 'admin.navigation.system',
    icon: 'pi pi-server',
    route: ROUTES.ADMIN.SYSTEM,
    adminOnly: true
  }
];
