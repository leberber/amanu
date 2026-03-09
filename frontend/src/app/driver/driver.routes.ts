import { Routes } from '@angular/router';

export const DRIVER_ROUTES: Routes = [
  // Redirect /driver/register to main register page
  // The main register page now handles both customer and driver registration
  {
    path: 'register',
    redirectTo: '/register',
    pathMatch: 'full'
  }
];
