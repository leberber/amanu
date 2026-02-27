import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  // Mobile drawer state
  drawerVisible = signal(false);

  // Desktop collapsed state
  collapsed = signal(false);

  openDrawer(): void {
    this.drawerVisible.set(true);
  }

  closeDrawer(): void {
    this.drawerVisible.set(false);
  }

  toggleDrawer(): void {
    this.drawerVisible.update(v => !v);
  }

  toggleCollapsed(): void {
    this.collapsed.update(v => !v);
  }

  setCollapsed(value: boolean): void {
    this.collapsed.set(value);
  }
}
