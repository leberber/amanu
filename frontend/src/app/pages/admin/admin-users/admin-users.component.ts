// src/app/pages/admin/admin-users/admin-users.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../../services/admin.service';
import { UserManage, UsersResponse } from '../../../models/admin.model';
import { UserFormComponent, UserFormData, UserFormConfig } from '../../../shared/components/user-form/user-form.component';
import { DateService } from '../../../core/services/date.service';
import { SearchDebounceService } from '../../../core/services/search-debounce.service';
import { ConfirmationDialogService } from '../../../core/services/confirmation-dialog.service';
import { StatusSeverityService } from '../../../core/services/status-severity.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    ToastModule,
    TagModule,
    PaginatorModule,
    DialogModule,
    ConfirmDialogModule,
    SelectModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    ProgressSpinnerModule,
    TranslateModule,
    UserFormComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
  styles: [`
    :host ::ng-deep .p-datatable-header {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  `]
})
export class AdminUsersComponent implements OnInit {
  // Data properties
  allUsers: UserManage[] = [];
  users: UserManage[] = [];
  totalRecords = 0;
  
  
  // UI state
  loading = true;
  searchQuery = '';
  filterRole = '';
  page = 1;
  pageSize = 10;
  
  // Dialog state
  selectedUser: UserManage | null = null;
  displayUserDialog = false;
  isEditing = false;
  
  // User form configuration
  userFormConfig: UserFormConfig = {
    mode: 'create',
    showRoleSelection: true,
    showActiveToggle: true,
    showAddressField: true,
    showPhoneField: true,
    passwordRequired: true,
    showCancelButton: true
  };
  userFormData?: Partial<UserFormData>;
  
  // Options
  roleOptions: any[] = [];
  
  // Private properties
  
  // Services injected using inject()
  private adminService = inject(AdminService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private dateService = inject(DateService);
  private searchDebounce = inject(SearchDebounceService);
  private confirmDialog = inject(ConfirmationDialogService);
  private statusSeverity = inject(StatusSeverityService);

  ngOnInit(): void {
    this.initializeRoleOptions();
    this.loadAllUsers();
    
    // Update role options when language changes
    this.translateService.onLangChange.subscribe(() => {
      this.initializeRoleOptions();
    });
  }
  
  initializeRoleOptions() {
    this.roleOptions = [
      { label: this.translateService.instant('admin.users.filters.all_roles'), value: '' },
      { label: this.translateService.instant('admin.users.roles.customer'), value: 'customer' },
      { label: this.translateService.instant('admin.users.roles.staff'), value: 'staff' },
      { label: this.translateService.instant('admin.users.roles.admin'), value: 'admin' }
    ];
  }


  // ===== DATA LOADING =====
  
  loadAllUsers(): void {
    this.loading = true;
    console.log('Starting to load users...');
    
    this.adminService.getAllUsers(1, 1000).subscribe({
      next: (response: UsersResponse) => {
        console.log('Raw API response:', response);
        console.log('Users in response:', response.users);
        console.log('Total in response:', response.total);
        
        this.allUsers = response.users || [];
        this.users = response.users || [];
        this.totalRecords = response.total || 0;
        
        console.log('Final users array length:', this.users.length);
        console.log('Final users array:', this.users);
        
        this.loading = false;
      },
      error: (error) => this.handleLoadError(error)
    });
  }

  private handleLoadError(error: any): void {
    console.error('Error loading users:', error);
    console.error('Error status:', error.status);
    console.error('Error details:', error.error);
    
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
    
    // Reset data on error
    this.allUsers = [];
    this.users = [];
    this.totalRecords = 0;
  }

  // ===== FILTERING =====
  
  hasActiveFilters(): boolean {
    return !!(this.searchQuery?.trim() || this.filterRole);
  }

  filterUsers(): void {
    let filtered = [...this.allUsers];

    // Apply search filter
    if (this.searchQuery?.trim()) {
      const search = this.searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.role?.toLowerCase().includes(search)
      );
    }

    // Apply role filter
    if (this.filterRole) {
      filtered = filtered.filter(user => user.role === this.filterRole);
    }

    this.users = filtered;
    this.totalRecords = filtered.length;
    
    console.log(`Filtered ${filtered.length} users from ${this.allUsers.length} total`);
  }

  onSearchInput(): void {
    // Use the debounce service instead of managing timeout manually
    this.searchDebounce.debounce('users-search', () => {
      this.filterUsers();
    });
  }

  onRoleChange(): void {
    this.filterUsers();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterRole = '';
    this.filterUsers();
  }

  // ===== USER DIALOG MANAGEMENT =====
  
  openUserDetails(user: UserManage): void {
    this.selectedUser = user;
    this.isEditing = true;
    
    this.userFormConfig = {
      mode: 'edit',
      showRoleSelection: true,
      showActiveToggle: true,
      showAddressField: true,
      showPhoneField: true,
      passwordRequired: false,
      showCancelButton: true
    };
    
    this.userFormData = {
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      address: user.address || '',
      role: user.role,
      is_active: user.is_active
    };
    
    this.displayUserDialog = true;
  }

  createNewUser(): void {
    this.selectedUser = null;
    this.isEditing = false;
    
    this.userFormConfig = {
      mode: 'create',
      showRoleSelection: true,
      showActiveToggle: true,
      showAddressField: true,
      showPhoneField: true,
      passwordRequired: true,
      showCancelButton: true
    };
    
    this.userFormData = {
      role: 'customer',
      is_active: true
    };
    
    this.displayUserDialog = true;
  }

  onUserFormSubmit(formData: UserFormData): void {
    if (this.isEditing && this.selectedUser) {
      this.updateExistingUser(formData);
    } else {
      this.createUser(formData);
    }
  }
  
  onUserFormCancel(): void {
    this.displayUserDialog = false;
  }

  private updateExistingUser(userData: any): void {
    if (!this.selectedUser) return;
    
    this.adminService.updateUser(this.selectedUser.id, userData).subscribe({
      next: (updatedUser: UserManage) => {
        // Update user in arrays
        const allIndex = this.allUsers.findIndex(u => u.id === this.selectedUser?.id);
        if (allIndex !== -1) {
          this.allUsers[allIndex] = updatedUser;
        }
        
        // Reapply filters to update display
        this.filterUsers();
        
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('admin.users.messages.user_updated'),
          detail: this.translateService.instant('admin.users.messages.user_updated_detail', { name: updatedUser.full_name })
        });
        
        this.displayUserDialog = false;
        
        // Update selected user reference
        if (this.selectedUser && this.selectedUser.id === updatedUser.id) {
          this.selectedUser = updatedUser;
        }
      },
      error: (error) => {
        console.error('Error updating user:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('admin.users.messages.update_failed'),
          detail: error.error?.detail || this.translateService.instant('admin.users.messages.update_failed_detail')
        });
      }
    });
  }

  private createUser(userData: UserFormData): void {
    this.adminService.createUser(userData).subscribe({
      next: (newUser: UserManage) => {
        // Add new user to arrays
        this.allUsers.unshift(newUser);
        
        // Reapply filters to update display
        this.filterUsers();
        
        this.messageService.add({
          severity: 'success',
          summary: this.translateService.instant('admin.users.messages.user_created'),
          detail: this.translateService.instant('admin.users.messages.user_created_detail', { name: newUser.full_name })
        });
        
        this.displayUserDialog = false;
      },
      error: (error) => {
        console.error('Error creating user:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translateService.instant('admin.users.messages.create_failed'),
          detail: error.error?.detail || this.translateService.instant('admin.users.messages.create_failed_detail')
        });
      }
    });
  }

  // ===== USER DELETION =====
  
  confirmDeleteUser(user: UserManage): void {
    this.confirmDialog.confirmDelete(user.full_name, () => {
      this.deleteUser(user);
    });
  }

  private deleteUser(user: UserManage): void {
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        // Remove deleted user from arrays
        this.allUsers = this.allUsers.filter(u => u.id !== user.id);
        
        // Reapply current filters
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

  // ===== UI UTILITIES =====
  
  refreshUserData(): void {
    this.loadAllUsers();
  }

  exportUsers(): void {
    // TODO: Implement export functionality
    this.messageService.add({
      severity: 'info',
      summary: this.translateService.instant('admin.users.export'),
      detail: this.translateService.instant('admin.users.export_coming_soon')
    });
  }

  onPageChange(event: any): void {
    this.page = event.page + 1;
    this.pageSize = event.rows;
    this.loadAllUsers();
  }

  getRoleSeverity(role: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" {
    return this.statusSeverity.getRoleSeverity(role);
  }

  formatDate(dateString: string): string {
    return this.dateService.formatDate(dateString);
  }

  navigateAddUser() {
    this.createNewUser();
  }
}