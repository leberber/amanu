/**
 * Centralized route constants to avoid hardcoded route strings
 * throughout the application
 */

export const ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/products/:id',
  CART: '/cart',
  ORDER_SUMMARY: '/order-summary',
  CHECKOUT: '/checkout',

  // Info pages
  ABOUT: '/about',
  CONTACT: '/contact',
  TERMS: '/terms',
  PRIVACY: '/privacy-policy',

  // User routes
  ACCOUNT: '/account',
  ORDERS: '/orders',
  ORDER_PAYMENTS: '/orders/payments',
  ORDER_DETAIL: '/orders/:id',
  PROMOTIONS: '/promotions',
  NEW_ARRIVALS: '/nouveautes',
  SETTINGS: '/settings',
  NOTIFICATIONS: '/notifications',
  COMPLETE_PROFILE: '/complete-profile',
  
  // Driver routes
  DRIVER: {
    ROOT: '/driver',
    BASE: '/driver',
    DASHBOARD: '/driver',
    ACTIVE: '/driver/active',
    TRIP_DETAIL: '/driver/trip/:id',
    HISTORY: '/driver/history',
    EARNINGS: '/driver/earnings',
    PROFILE: '/driver/profile',
    SETTINGS: '/driver/settings'
  },

  // Admin routes
  ADMIN: {
    BASE: '/admin',
    DASHBOARD: '/admin',
    PRODUCTS: '/admin/products',
    ADD_PRODUCT: '/admin/products/add',
    EDIT_PRODUCT: '/admin/products/edit/:id',
    CATEGORIES: '/admin/categories',
    ADD_CATEGORY: '/admin/categories/add',
    EDIT_CATEGORY: '/admin/categories/edit/:id',
    BRANDS: '/admin/brands',
    ADD_BRAND: '/admin/brands/add',
    EDIT_BRAND: '/admin/brands/edit/:id',
    PROMOTIONS: '/admin/promotions',
    ADD_PROMOTION: '/admin/promotions/add',
    EDIT_PROMOTION: '/admin/promotions/edit/:id',
    CROSS_SELL_PROMOTIONS: '/admin/cross-sell-promotions',
    ADD_CROSS_SELL_PROMOTION: '/admin/cross-sell-promotions/add',
    EDIT_CROSS_SELL_PROMOTION: '/admin/cross-sell-promotions/edit/:id',
    VOLUME_DISCOUNTS: '/admin/volume-discounts',
    ADD_VOLUME_DISCOUNT: '/admin/volume-discounts/add',
    EDIT_VOLUME_DISCOUNT: '/admin/volume-discounts/edit/:id',
    ORDERS: '/admin/orders',
    ORDER_NEW: '/admin/orders/new',
    ORDER_DETAIL: '/admin/orders/:id',
    USERS: '/admin/users',
    USERS_MAP: '/admin/users/map',
    ADD_USER: '/admin/users/add',
    EDIT_USER: '/admin/users/edit/:id',
    USER_GROUPS: '/admin/user-groups',
    ADD_USER_GROUP: '/admin/user-groups/add',
    EDIT_USER_GROUP: '/admin/user-groups/edit/:id',
    NOTIFICATIONS: '/admin/notifications',
    SHIPPING: '/admin/shipping',
    BATCHING: '/admin/batching',
    DRIVER_MANAGEMENT: '/admin/drivers',
    DRIVER_CONFIG: '/admin/drivers/config',
    LOGS: '/admin/logs',
    SYSTEM: '/admin/system',
    SALES_REPORT: '/admin/sales-report',
    STOCK: '/admin/purchasing',
    PURCHASE_ORDERS: '/admin/purchase-orders',
    SUPPLIERS: '/admin/suppliers',
    ADD_SUPPLIER: '/admin/suppliers/new',
    EDIT_SUPPLIER: '/admin/suppliers/:id/edit',
    SUPPLIER_DETAIL: '/admin/suppliers/:id',
    FACTURATION: '/admin/facturation',
    FACTURATION_NEW: '/admin/facturation/new',
    COMPANY_SETTINGS: '/admin/company-settings'
  }
} as const;

/**
 * Helper functions for dynamic routes
 */
export const RouteHelpers = {
  productDetail: (id: number | string) => `/products/${id}`,
  orderDetail: (id: number | string) => `/orders/${id}`,
  adminOrderDetail: (id: number | string) => `/admin/orders/${id}`,
  adminEditProduct: (id: number | string) => `/admin/products/edit/${id}`,
  adminEditCategory: (id: number | string) => `/admin/categories/edit/${id}`,
  adminEditBrand: (id: number | string) => `/admin/brands/edit/${id}`,
  adminEditPromotion: (id: number | string) => `/admin/promotions/edit/${id}`,
  adminEditCrossSellPromotion: (id: number | string) => `/admin/cross-sell-promotions/edit/${id}`,
  adminEditVolumeDiscount: (id: number | string) => `/admin/volume-discounts/edit/${id}`,
  adminEditUser: (id: number | string) => `/admin/users/${id}/edit`,
  adminEditUserGroup: (id: number | string) => `/admin/user-groups/edit/${id}`,
  driverTripDetail: (id: number | string) => `/driver/trip/${id}`,
  adminPurchaseOrderDetail: (id: number | string) => `/admin/purchase-orders/${id}`,
  adminSupplierDetail: (id: number | string) => `/admin/suppliers/${id}`,
  adminEditSupplier: (id: number | string) => `/admin/suppliers/${id}/edit`,
  adminFacturationDetail: (id: number | string) => `/admin/facturation/${id}`
};

/**
 * Route groups for guard checks
 */
export const RouteGroups = {
  PUBLIC: [
    ROUTES.HOME,
    ROUTES.LOGIN,
    ROUTES.REGISTER,
    ROUTES.PRODUCTS,
    ROUTES.PRODUCT_DETAIL,
    ROUTES.CART
  ],
  AUTHENTICATED: [
    ROUTES.ACCOUNT,
    ROUTES.ORDERS,
    ROUTES.ORDER_DETAIL,
    ROUTES.CHECKOUT
  ],
  DRIVER: Object.values(ROUTES.DRIVER),
  ADMIN: Object.values(ROUTES.ADMIN),
  GUEST_ONLY: [
    ROUTES.LOGIN,
    ROUTES.REGISTER
  ]
};

/**
 * Default redirects
 */
export const DefaultRedirects = {
  AFTER_LOGIN: ROUTES.HOME,
  AFTER_LOGOUT: ROUTES.LOGIN,
  UNAUTHORIZED: ROUTES.HOME,
  NOT_FOUND: ROUTES.HOME,
  ADMIN_DEFAULT: ROUTES.ADMIN.DASHBOARD,
  STAFF_DEFAULT: ROUTES.ADMIN.ORDERS,
  DRIVER_DEFAULT: ROUTES.DRIVER.DASHBOARD
};