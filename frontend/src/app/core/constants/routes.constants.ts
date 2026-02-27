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
  CHECKOUT: '/checkout',

  // Info pages
  ABOUT: '/about',
  CONTACT: '/contact',
  TERMS: '/terms',
  PRIVACY: '/privacy-policy',

  // User routes
  ACCOUNT: '/account',
  ORDERS: '/orders',
  ORDER_DETAIL: '/orders/:id',
  PROMOTIONS: '/promotions',
  SETTINGS: '/settings',
  NOTIFICATIONS: '/notifications',
  
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
    ORDERS: '/admin/orders',
    ORDER_DETAIL: '/admin/orders/:id',
    USERS: '/admin/users',
    ADD_USER: '/admin/users/add',
    EDIT_USER: '/admin/users/edit/:id',
    NOTIFICATIONS: '/admin/notifications'
  }
} as const;

/**
 * Helper functions for dynamic routes
 */
export const RouteHelpers = {
  productDetail: (id: number | string) => `/products/${id}`,
  orderDetail: (id: number | string) => `/orders/${id}`,
  adminEditProduct: (id: number | string) => `/admin/products/edit/${id}`,
  adminEditCategory: (id: number | string) => `/admin/categories/edit/${id}`,
  adminEditBrand: (id: number | string) => `/admin/brands/edit/${id}`,
  adminEditPromotion: (id: number | string) => `/admin/promotions/edit/${id}`,
  adminEditUser: (id: number | string) => `/admin/users/${id}/edit`
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
  STAFF_DEFAULT: ROUTES.ADMIN.ORDERS
};