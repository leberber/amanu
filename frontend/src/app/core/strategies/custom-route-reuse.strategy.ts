import { Injectable } from '@angular/core';
import { RouteReuseStrategy, ActivatedRouteSnapshot, DetachedRouteHandle } from '@angular/router';

@Injectable()
export class CustomRouteReuseStrategy implements RouteReuseStrategy {
  private storedRoutes = new Map<string, DetachedRouteHandle>();

  // Routes to cache when navigating away
  private routesToCache = new Set(['admin/products', 'admin/orders']);

  private getRoutePath(route: ActivatedRouteSnapshot): string | null {
    const segments = [];
    let current: ActivatedRouteSnapshot | null = route;
    while (current) {
      if (current.routeConfig?.path) {
        segments.unshift(current.routeConfig.path);
      }
      current = current.parent;
    }
    return segments.join('/');
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const path = this.getRoutePath(route);
    return !!path && this.routesToCache.has(path);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const path = this.getRoutePath(route);
    if (path && handle) {
      this.storedRoutes.set(path, handle);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const path = this.getRoutePath(route);
    return !!path && this.storedRoutes.has(path);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const path = this.getRoutePath(route);
    if (!path) return null;
    return this.storedRoutes.get(path) || null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  // Clear cached routes (useful for logout)
  clearCache(): void {
    this.storedRoutes.clear();
  }
}
