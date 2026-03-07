import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  // Mobile drawer state
  drawerVisible = signal(false);

  // Desktop collapsed state
  collapsed = signal(false);

  // Track if drawer should reopen on back navigation
  private shouldReopenOnBack = false;

  constructor() {
    // Listen for back button to reopen drawer if needed
    window.addEventListener('popstate', () => {
      if (this.shouldReopenOnBack) {
        this.shouldReopenOnBack = false;
        setTimeout(() => this.drawerVisible.set(true), 50);
      }
    });
  }

  openDrawer(): void {
    this.drawerVisible.set(true);
  }

  closeDrawer(): void {
    this.drawerVisible.set(false);
  }

  // Close drawer with option to reopen on back navigation
  closeDrawerWithBackBehavior(reopenOnBack: boolean): void {
    this.shouldReopenOnBack = reopenOnBack;
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
