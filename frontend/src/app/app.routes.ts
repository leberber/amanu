// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { HomeComponent } from './pages/home/home.component';
import { ProductListComponent } from './pages/products/product-list/product-list.component';
import { ProductDetailComponent } from './pages/products/product-detail/product-detail.component';
import { authGuard } from './shared/auth.guard';
import { CartComponent } from './pages/cart/cart.component';
import { adminGuard } from './shared/admin.guard'; 
import { AdminProductsComponent } from './pages/admin/admin-products/admin-products.component';
import { AdminAddProductComponent } from './pages/admin/admin-add-product/admin-add-product.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'products', component: ProductListComponent },
  { path: 'products/:id', component: ProductDetailComponent },
  { path: 'cart', component: CartComponent },
  
  // Admin Routes
  { 
    path: 'admin', 
    loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [adminGuard]
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
    data: { mode: 'add' }
  },
  { 
    path: 'admin/products/edit/:id', 
    component: AdminAddProductComponent, 
    canActivate: [adminGuard],
    data: { mode: 'edit' }
  },
  { 
    path: 'admin/categories/add', 
    loadComponent: () => import('./pages/admin/admin-add-category/admin-add-category.component').then(m => m.AdminAddCategoryComponent),
    canActivate: [adminGuard]
  },
  { 
    path: 'admin/orders', 
    loadComponent: () => import('./pages/admin/admin-orders/admin-orders.component').then(m => m.AdminOrdersComponent),
    canActivate: [adminGuard]
  },
  { 
    path: 'admin/users', 
    loadComponent: () => import('./pages/admin/admin-users/admin-users.component').then(m => m.AdminUsersComponent),
    canActivate: [adminGuard]
  },
  
  // User Routes
  { 
    path: 'checkout', 
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'orders', 
    loadComponent: () => import('./pages/orders/order-list/order-list.component').then(m => m.OrderListComponent),
    canActivate: [authGuard]
  },
  { 
    path: 'orders/:id', 
    loadComponent: () => import('./pages/orders/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    canActivate: [authGuard]
  },
  
  { path: '**', redirectTo: '' }
];