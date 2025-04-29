import { Routes } from '@angular/router';
import { LoginComponent } from './pages/admin/login/login.component';
import { UserListComponent } from './pages/admin/user-list/user-list.component';
import { AccountComponent } from './pages/admin/account/account.component';
import { OrderComponent } from './pages/admin/order/order.component';
import { authGuard } from './auth.guard';

// import { authGuard } from './services/auth.guard'; // Adjust path as needed




export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'admin',
    component: UserListComponent,
    canActivate: [authGuard],
  },
  {
    path: 'account',
    component: AccountComponent,
    canActivate: [authGuard],
  },
  {
    path: 'orders',
    component: OrderComponent,
    canActivate: [authGuard],
  },
];

