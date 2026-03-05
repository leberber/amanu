import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { HomeComponent } from './pages/home/home.component';
import { ProductListComponent } from './pages/products/product-list/product-list.component';
import { ProductDetailComponent } from './pages/products/product-detail/product-detail.component';
import { authGuard } from './shared/auth.guard';
import { CartComponent } from './pages/cart/cart.component';
import { adminGuard } from './shared/admin.guard';
import { adminOnlyGuard } from './shared/admin-only.guard';
import { AdminProductsComponent } from './pages/admin/admin-products/admin-products.component';
import { AdminAddProductComponent } from './pages/admin/admin-add-product/admin-add-product.component';
import { AdminAddCategoryComponent } from './pages/admin/admin-add-category/admin-add-category.component';
import { AdminCategoriesComponent } from './pages/admin/admin-categories/admin-categories.component';
import { AdminBrandsComponent } from './pages/admin/admin-brands/admin-brands.component';
import { AdminAddBrandComponent } from './pages/admin/admin-add-brand/admin-add-brand.component';
import { AdminPromotionsComponent } from './pages/admin/admin-promotions/admin-promotions.component';
import { AdminAddPromotionComponent } from './pages/admin/admin-add-promotion/admin-add-promotion.component';

export const routes: Routes = [
  // Public Routes - No auth required
  { path: '', component: ProductListComponent },
  { path: 'home', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'products', component: ProductListComponent },
  { path: 'products/:id', component: ProductDetailComponent, data: { hideBottomNav: true } },
  { path: 'cart', component: CartComponent, data: { hideBottomNav: true } },
  {
    path: 'order-summary',
    loadComponent: () => import('./pages/order-summary/order-summary.component').then(m => m.OrderSummaryComponent),
    data: { hideBottomNav: true }
  },
  
  // Admin Routes
  { 
  path: 'admin/categories', 
  component: AdminCategoriesComponent,
  canActivate: [adminGuard]
},

  { 
    path: 'admin', 
    loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [adminOnlyGuard]
  },
  { 
    path: 'admin/products', 
    component: AdminProductsComponent, 
    canActivate: [adminGuard] 
  },
  {
    path: 'admin/products/add',
    component: AdminAddProductComponent,
    canActivate: [adminGuard],
    data: { mode: 'add', hideBottomNav: true }
  },
  {
    path: 'admin/products/edit/:id',
    component: AdminAddProductComponent,
    canActivate: [adminGuard],
    data: { mode: 'edit', hideBottomNav: true }
  },
  // FIXED: Only one category route using direct import
  { 
    path: 'admin/categories/add', 
    component: AdminAddCategoryComponent,
    canActivate: [adminGuard],
    data: { mode: 'add', hideBottomNav: true }
  },
  {
    path: 'admin/categories/edit/:id',
    component: AdminAddCategoryComponent,
    canActivate: [adminGuard],
    data: { mode: 'edit', hideBottomNav: true }
  },
  // Brands Routes
  {
    path: 'admin/brands',
    component: AdminBrandsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'admin/brands/add',
    component: AdminAddBrandComponent,
    canActivate: [adminGuard],
    data: { mode: 'add', hideBottomNav: true }
  },
  {
    path: 'admin/brands/edit/:id',
    component: AdminAddBrandComponent,
    canActivate: [adminGuard],
    data: { mode: 'edit', hideBottomNav: true }
  },
  // Promotions Routes
  {
    path: 'admin/promotions',
    component: AdminPromotionsComponent,
    canActivate: [adminGuard]
  },
  {
    path: 'admin/promotions/add',
    component: AdminAddPromotionComponent,
    canActivate: [adminGuard],
    data: { mode: 'add', hideBottomNav: true }
  },
  {
    path: 'admin/promotions/edit/:id',
    component: AdminAddPromotionComponent,
    canActivate: [adminGuard],
    data: { mode: 'edit', hideBottomNav: true }
  },
  // Notifications Route
  {
    path: 'admin/notifications',
    loadComponent: () => import('./pages/admin/admin-notifications/admin-notifications.component').then(m => m.AdminNotificationsComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/orders',
    loadComponent: () => import('./pages/admin/admin-orders/admin-orders.component').then(m => m.AdminOrdersComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/orders/:id',
    loadComponent: () => import('./pages/admin/admin-order-detail/admin-order-detail.component').then(m => m.AdminOrderDetailComponent),
    canActivate: [adminGuard],
    data: { hideBottomNav: true }
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./pages/admin/admin-users/admin-users.component').then(m => m.AdminUsersComponent),
    canActivate: [adminOnlyGuard]
  },
  {
    path: 'admin/users/:id/edit',
    loadComponent: () => import('./pages/admin/admin-edit-user/admin-edit-user.component').then(m => m.AdminEditUserComponent),
    canActivate: [adminOnlyGuard],
    data: { hideBottomNav: true }
  },
  // User Groups Routes
  {
    path: 'admin/user-groups',
    loadComponent: () => import('./pages/admin/admin-user-groups/admin-user-groups.component').then(m => m.AdminUserGroupsComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'admin/user-groups/add',
    loadComponent: () => import('./pages/admin/admin-add-user-group/admin-add-user-group.component').then(m => m.AdminAddUserGroupComponent),
    canActivate: [adminGuard],
    data: { mode: 'add', hideBottomNav: true }
  },
  {
    path: 'admin/user-groups/edit/:id',
    loadComponent: () => import('./pages/admin/admin-add-user-group/admin-add-user-group.component').then(m => m.AdminAddUserGroupComponent),
    canActivate: [adminGuard],
    data: { mode: 'edit', hideBottomNav: true }
  },

  // User Routes
  {
    path: 'account',
    loadComponent: () => import('./pages/account/account.component').then(m => m.AccountComponent),
    canActivate: [authGuard],
    data: { hideBottomNav: true }
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: [authGuard],
    data: { hideBottomNav: true }
  },
  { 
    path: 'orders', 
    loadComponent: () => import('./pages/orders/order-list/order-list.component').then(m => m.OrderListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'orders/:id',
    loadComponent: () => import('./pages/orders/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    canActivate: [authGuard],
    data: { hideBottomNav: true }
  },

  // Stock Page (public - no auth required)
  {
    path: 'stock',
    loadComponent: () => import('./pages/stock/stock.component').then(m => m.StockComponent)
  },

  // Public Routes
  {
    path: 'privacy-policy',
    loadComponent: () => import('./pages/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent)
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms/terms.component').then(m => m.TermsComponent),
    data: { hideBottomNav: true }
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
    data: { hideBottomNav: true }
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent)
  },
  {
    path: 'promotions',
    loadComponent: () => import('./pages/promotions/promotions.component').then(m => m.PromotionsComponent),
    data: { hideBottomNav: true }
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard],
    data: { hideBottomNav: true }
  },
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [authGuard],
    data: { hideBottomNav: true }
  },
  {
    path: 'complete-profile',
    loadComponent: () => import('./pages/complete-profile/complete-profile.component').then(m => m.CompleteProfileComponent),
    canActivate: [authGuard],
    data: { hideBottomNav: true }
  },

  { path: '**', redirectTo: '' }
];