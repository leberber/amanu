import { Routes } from '@angular/router';
import { LoginComponent } from './pages/admin/login/login.component';
import { UserListComponent } from './pages/admin/user-list/user-list.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'users',
    component: UserListComponent,
  },
];
