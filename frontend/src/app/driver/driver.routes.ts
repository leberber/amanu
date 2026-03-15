import { Routes } from '@angular/router';
import { driverGuard } from '../shared/driver.guard';

export const DRIVER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/driver-layout.component').then(m => m.DriverLayoutComponent),
    canActivate: [driverGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/driver-dashboard.component').then(m => m.DriverDashboardComponent)
      },
      {
        path: 'active',
        loadComponent: () => import('./pages/active/driver-active.component').then(m => m.DriverActiveComponent)
      },
      {
        path: 'trip/:id',
        loadComponent: () => import('./pages/trip-detail/driver-trip-detail.component').then(m => m.DriverTripDetailComponent),
        data: { hideBottomNav: true }
      },
      {
        path: 'history',
        loadComponent: () => import('./pages/history/driver-history.component').then(m => m.DriverHistoryComponent)
      },
      {
        path: 'earnings',
        loadComponent: () => import('./pages/earnings/driver-earnings.component').then(m => m.DriverEarningsComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/driver-profile.component').then(m => m.DriverProfileComponent)
      }
    ]
  }
];
