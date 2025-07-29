import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-mobile-admin-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, DialogModule, ButtonModule, TranslateModule],
  template: `
    <p-dialog 
      [(visible)]="visible" 
      [modal]="true" 
      [showHeader]="false"
      [style]="{width: '100vw'}"
      [baseZIndex]="10000"
      [draggable]="false"
      [resizable]="false"
      position="bottom">
      
      <div class="admin-menu-content ">
        <div class="flex align-items-center justify-content-between mb-4 pb-3 border-bottom-1 surface-border">
          <h3 class="m-0 text-xl font-semibold">{{ 'header.admin' | translate }}</h3>
          <button 
            pButton 
            type="button" 
            icon="pi pi-times" 
            class="p-button-rounded p-button-text p-button-plain"
            (click)="hide()"></button>
        </div>
        
        <div class="grid gap-2">
          <!-- Dashboard (Admin only) -->
          <a *ngIf="isAdmin()" 
             routerLink="/admin" 
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-chart-bar mr-3"></i>
            <span>{{ 'admin.navigation.dashboard' | translate }}</span>
          </a>
          
          <!-- Orders -->
          <a routerLink="/admin/orders" 
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-list mr-3"></i>
            <span>{{ 'admin.navigation.orders' | translate }}</span>
          </a>
          
          <!-- Products -->
          <a routerLink="/admin/products" 
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-tag mr-3"></i>
            <span>{{ 'admin.navigation.products' | translate }}</span>
          </a>
          
          <!-- Categories -->
          <a routerLink="/admin/categories" 
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-tags mr-3"></i>
            <span>{{ 'admin.navigation.categories' | translate }}</span>
          </a>
          
          <!-- Users (Admin only) -->
          <a *ngIf="isAdmin()" 
             routerLink="/admin/users" 
             (click)="hide()"
             class="menu-item">
            <i class="pi pi-users mr-3"></i>
            <span>{{ 'admin.navigation.users' | translate }}</span>
          </a>
        </div>
      </div>
    </p-dialog>
  `,
  styles: [`
    :host ::ng-deep {
      .p-dialog {
        margin: 0 !important;
        border-radius: 1rem 1rem 0 0;
        overflow: hidden;
        width: 100vw !important;
        max-width: 100vw !important;
        left: 0 !important;
        right: 0 !important;
      }
      
      .p-dialog-content {
        padding: 0;
        border-radius: 1rem 1rem 0 0;
        overflow: hidden;
      }
      
      .p-dialog-wrapper {
        padding: 0 !important;
      }
    }
    
    .admin-menu-content {
      padding: 1.5rem;
    }
    
    .menu-item {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      text-decoration: none;
      color: var(--text-color);
      transition: all 0.2s;
      font-weight: 500;
    }
    
    .menu-item:hover {
      background-color: var(--surface-hover);
      color: var(--primary-color);
    }
    
    .menu-item i {
      font-size: 1.25rem;
      color: var(--text-color-secondary);
    }
    
    .menu-item:hover i {
      color: var(--primary-color);
    }
    
    /* Dark theme support */
    :host-context(.my-app-dark) .menu-item {
      color: var(--text-color);
    }
    
    :host-context(.my-app-dark) .menu-item:hover {
      background-color: var(--surface-hover);
    }
  `]
})
export class MobileAdminMenuComponent {
  private authService = inject(AuthService);
  visible = false;
  
  show() {
    this.visible = true;
  }
  
  hide() {
    this.visible = false;
  }
  
  isAdmin(): boolean {
    return this.authService.isAdmin();
  }
}