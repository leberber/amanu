import { Routes } from '@angular/router';
import { IcfComponent } from './pages/icf/icf/icf.component';

export const routes: Routes = [
  { path: 'icf', component: IcfComponent },
  { path: '', redirectTo: 'icf', pathMatch: 'full' },
];
