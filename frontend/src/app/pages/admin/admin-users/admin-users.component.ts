// src/app/pages/admin/admin-users/admin-users.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ToastMessageService } from '../../../core/services/toast-message.service';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../../services/admin.service';
import { UserManage, UsersResponse } from '../../../models/admin.model';
import { ROUTES } from '../../../core/constants/routes.constants';
import { BaseAdminListComponent } from '../../../shared/base/base-admin-list.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    ConfirmDialogModule,
    SelectModule,
    TooltipModule,
    TranslateModule
  ],
  providers: [ConfirmationService],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent extends BaseAdminListComponent implements OnInit {
  // Data properties
  allUsers: UserManage[] = [];
  users: UserManage[] = [];
  totalRecords = 0;

  // Role segment filter
  roleFilter: 'all' | 'customer' | 'staff' | 'admin' = 'all';

  // Inline editing state - Role
  editingRoleUserId: number | null = null;
  editingRole: string = '';

  // Inline editing state - Status
  editingStatusUserId: number | null = null;
  editingStatus: boolean = true;

  // Role options for dropdown
  roleOptions: { label: string; value: string }[] = [];

  // Services
  private adminService = inject(AdminService);
  private toast = inject(ToastMessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private confirmationService = inject(ConfirmationService);

  ngOnInit(): void {
    this.initializeOptions();
    this.loadAllUsers();

    // Update options when language changes
    this.translateService.onLangChange.subscribe(() => {
      this.initializeOptions();
    });
  }

  initializeOptions() {
    // Role options for inline dropdown editing
    this.roleOptions = [
      { label: this.translateService.instant('admin.users.roles.customer'), value: 'customer' },
      { label: this.translateService.instant('admin.users.roles.staff'), value: 'staff' },
      { label: this.translateService.instant('admin.users.roles.admin'), value: 'admin' }
    ];
  }

  // ===== DATA LOADING =====

  loadAllUsers(): void {
    this.loading = true;

    this.adminService.getAllUsers(1, 1000).subscribe({
      next: (response: UsersResponse) => {
        this.allUsers = response.users || [];
        this.filterItems();
        this.loading = false;
      },
      error: (error) => this.handleLoadError(error)
    });
  }

  private handleLoadError(error: any): void {
    console.error('Error loading users:', error);
    this.loading = false;

    if (error.status === 403) {
      this.toast.showPermissionDenied();
      this.router.navigate(['/']);
    } else {
      this.toast.showError('admin.users.load_error');
    }

    this.allUsers = [];
    this.users = [];
    this.totalRecords = 0;
  }

  // ===== ROLE SEGMENT FILTER =====

  onRoleFilterChange(role: 'all' | 'customer' | 'staff' | 'admin'): void {
    this.roleFilter = role;
    this.filterItems();
  }

  getCustomerCount(): number {
    return this.allUsers.filter(u => u.role === 'customer').length;
  }

  getStaffCount(): number {
    return this.allUsers.filter(u => u.role === 'staff').length;
  }

  getAdminCount(): number {
    return this.allUsers.filter(u => u.role === 'admin').length;
  }

  // === Abstract method implementations ===

  filterItems(): void {
    let filtered = [...this.allUsers];

    // Apply role filter from segment
    if (this.roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === this.roleFilter);
    }

    // Apply search filter
    if (this.hasSearchQuery()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.full_name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.role?.toLowerCase().includes(search)
      );
    }

    this.users = filtered;
    this.totalRecords = filtered.length;
  }

  updatePaginatedItems(): void {
    // No pagination in users component - displays all filtered users
  }

  getSearchDebounceKey(): string {
    return 'users-search';
  }

  // === Component-specific methods ===

  hasActiveFilters(): boolean {
    return this.hasSearchQuery() || this.roleFilter !== 'all';
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.roleFilter = 'all';
    this.filterItems();
  }

  // ===== NAVIGATION =====

  navigateToEditUser(user: UserManage): void {
    this.router.navigate([ROUTES.ADMIN.USERS, user.id, 'edit']);
  }

  // ===== USER DELETION =====

  confirmDeleteUser(user: UserManage): void {
    this.confirmationService.confirm({
      message: this.translateService.instant('common.confirm_delete_message', { item: user.full_name }),
      header: this.translateService.instant('common.confirm_delete'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      acceptLabel: this.translateService.instant('common.delete'),
      rejectLabel: this.translateService.instant('common.cancel'),
      accept: () => this.deleteUser(user)
    });
  }

  private deleteUser(user: UserManage): void {
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.allUsers = this.allUsers.filter(u => u.id !== user.id);
        this.filterItems();
        this.toast.showSuccess('admin.users.messages.user_deleted_detail', { name: user.full_name });
      },
      error: (error) => {
        console.error('Error deleting user:', error);
        this.toast.showApiError(error, 'admin.users.messages.deletion_failed_detail');
      }
    });
  }

  // ===== INLINE ROLE EDITING =====

  startEditRole(user: UserManage): void {
    this.cancelEditStatus(); // Cancel any status edit
    this.editingRoleUserId = user.id;
    this.editingRole = user.role;
  }

  cancelEditRole(): void {
    this.editingRoleUserId = null;
    this.editingRole = '';
  }

  isEditingRole(userId: number): boolean {
    return this.editingRoleUserId === userId;
  }

  saveRole(user: UserManage): void {
    if (this.editingRole === user.role) {
      this.cancelEditRole();
      return;
    }

    const previousRole = user.role;
    const newRole = this.editingRole;

    this.adminService.updateUser(user.id, { role: newRole }).subscribe({
      next: () => {
        // Update in allUsers
        const index = this.allUsers.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.allUsers[index].role = newRole;
        }
        // Update in filtered users
        const displayIndex = this.users.findIndex(u => u.id === user.id);
        if (displayIndex !== -1) {
          this.users[displayIndex].role = newRole;
        }

        this.toast.showSuccess('admin.users.messages.role_updated', { name: user.full_name });
        this.cancelEditRole();
      },
      error: (error) => {
        console.error('Error updating role:', error);
        this.toast.showError('admin.users.messages.update_failed_detail');
      }
    });
  }

  getRoleLabel(role: string): string {
    return this.translateService.instant(`admin.users.roles.${role}`);
  }

  // ===== INLINE STATUS EDITING =====

  startEditStatus(user: UserManage): void {
    this.cancelEditRole(); // Cancel any role edit
    this.editingStatusUserId = user.id;
    this.editingStatus = user.is_active;
  }

  cancelEditStatus(): void {
    this.editingStatusUserId = null;
    this.editingStatus = true;
  }

  isEditingStatus(userId: number): boolean {
    return this.editingStatusUserId === userId;
  }

  toggleEditingStatus(): void {
    this.editingStatus = !this.editingStatus;
  }

  saveStatus(user: UserManage): void {
    if (this.editingStatus === user.is_active) {
      this.cancelEditStatus();
      return;
    }

    const newStatus = this.editingStatus;

    this.adminService.updateUser(user.id, { is_active: newStatus }).subscribe({
      next: () => {
        // Update in allUsers
        const index = this.allUsers.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.allUsers[index].is_active = newStatus;
        }
        // Update in filtered users
        const displayIndex = this.users.findIndex(u => u.id === user.id);
        if (displayIndex !== -1) {
          this.users[displayIndex].is_active = newStatus;
        }

        this.toast.showSuccess('admin.users.messages.status_updated', { name: user.full_name });
        this.cancelEditStatus();
      },
      error: (error) => {
        console.error('Error updating status:', error);
        this.toast.showError('admin.users.messages.update_failed_detail');
      }
    });
  }

  // ===== UI UTILITIES =====

  refreshUserData(): void {
    this.loadAllUsers();
  }

  exportUsers(): void {
    this.toast.showInfo('admin.users.export_coming_soon');
  }
}
