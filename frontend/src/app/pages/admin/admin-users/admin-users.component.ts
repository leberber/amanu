// src/app/pages/admin/admin-users/admin-users.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../../services/admin.service';
import { UserManage, UsersResponse } from '../../../models/admin.model';
import { DateService } from '../../../core/services/date.service';
import { SearchDebounceService } from '../../../core/services/search-debounce.service';
import { ROUTES } from '../../../core/constants/routes.constants';

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
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit {
  // Data properties
  allUsers: UserManage[] = [];
  users: UserManage[] = [];
  totalRecords = 0;

  // UI state
  loading = true;
  searchQuery = '';

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
  private messageService = inject(MessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private dateService = inject(DateService);
  private searchDebounce = inject(SearchDebounceService);
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
        this.filterUsers();
        this.loading = false;
      },
      error: (error) => this.handleLoadError(error)
    });
  }

  private handleLoadError(error: any): void {
    console.error('Error loading users:', error);
    this.loading = false;

    let errorMessage = this.translateService.instant('admin.users.load_error');
    if (error.status === 403) {
      errorMessage = this.translateService.instant('admin.users.permission_error');
      this.router.navigate(['/']);
    }

    this.messageService.add({
      severity: 'error',
      summary: this.translateService.instant('common.error'),
      detail: errorMessage
    });

    this.allUsers = [];
    this.users = [];
    this.totalRecords = 0;
  }

  // ===== ROLE SEGMENT FILTER =====

  onRoleFilterChange(role: 'all' | 'customer' | 'staff' | 'admin'): void {
    this.roleFilter = role;
    this.filterUsers();
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

  // ===== FILTERING =====

  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.roleFilter !== 'all');
  }

  filterUsers(): void {
    let filtered = [...this.allUsers];

    // Apply role filter from segment
    if (this.roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === this.roleFilter);
    }

    // Apply search filter
    if (this.searchQuery?.trim()) {
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

  onSearchInput(): void {
    this.searchDebounce.debounce('users-search', () => {
      this.filterUsers();
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.roleFilter = 'all';
    this.filterUsers();
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
        this.filterUsers();

        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('admin.users.messages.user_deleted'),
          detail: this.translateService.instant('admin.users.messages.user_deleted_detail', { name: user.full_name })
        });
      },
      error: (error) => {
        console.error('Error deleting user:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('admin.users.messages.deletion_failed'),
          detail: error.error?.detail || this.translateService.instant('admin.users.messages.deletion_failed_detail')
        });
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

        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('admin.users.messages.role_updated', { name: user.full_name })
        });
        this.cancelEditRole();
      },
      error: (error) => {
        console.error('Error updating role:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('admin.users.messages.update_failed_detail')
        });
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

        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('common.success'),
          detail: this.translateService.instant('admin.users.messages.status_updated', { name: user.full_name })
        });
        this.cancelEditStatus();
      },
      error: (error) => {
        console.error('Error updating status:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('common.error'),
          detail: this.translateService.instant('admin.users.messages.update_failed_detail')
        });
      }
    });
  }

  // ===== UI UTILITIES =====

  refreshUserData(): void {
    this.loadAllUsers();
  }

  exportUsers(): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant('admin.users.export'),
      detail: this.translateService.instant('admin.users.export_coming_soon')
    });
  }

  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
  }
}
