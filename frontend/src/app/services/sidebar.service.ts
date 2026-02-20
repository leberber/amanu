import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  // State
  drawerVisible = signal(false);

  openDrawer(): void {
    this.drawerVisible.set(true);
  }

  closeDrawer(): void {
    this.drawerVisible.set(false);
  }

  toggleDrawer(): void {
    this.drawerVisible.update(v => !v);
  }
}
