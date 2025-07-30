/**
 * Centralized route constants to avoid hardcoded route strings
 * throughout the application
 */

export const ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/products/:id',
  CART: '/cart',
  CHECKOUT: '/checkout',
  
  // User routes
  ACCOUNT: '/account',
  ORDERS: '/orders',
  ORDER_DETAIL: '/orders/:id',
  
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
    ORDERS: '/admin/orders',
    USERS: '/admin/users',
    ADD_USER: '/admin/users/add',
    EDIT_USER: '/admin/users/edit/:id'
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
  adminEditUser: (id: number | string) => `/admin/users/edit/${id}`
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