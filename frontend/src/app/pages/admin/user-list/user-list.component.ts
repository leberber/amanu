import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Router } from '@angular/router';

import { User } from '../../../models/models';
import { DbService } from '../../../services/db.service';
import { UserDialogComponent } from '../user-dialog/user-dialog.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    ToastModule,
    ConfirmDialogModule,
    UserDialogComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss'
})
export class UserListComponent implements OnInit {
  private dbService = inject(DbService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private router = inject(Router);

  users: User[] = [];
  loading = true;
  dialogVisible = false;
  selectedUser: User | null = null;

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.dbService.getUsers().subscribe({
      next: (response) => {
        this.users = response;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching users:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load users. Please try again.',
          life: 3000
        });
        this.loading = false;
      }
    });
  }

  openNew(): void {
    this.selectedUser = null;
    this.dialogVisible = true;
  }

  editUser(user: User): void {
    this.selectedUser = user;
    this.dialogVisible = true;
  }

  handleAddUser(userData: User): void {
    this.addUser(userData);
  }

  handleUpdateUser(userData: User): void {
    // Update existing user
    this.dbService.updateUser(userData).subscribe({
      next: (response) => {
        this.messageService.add({
          severity: response.message.includes('Successfully') ? 'success' : 'warn',
          summary: response.message.includes('Successfully') ? 'Success' : 'Warning',
          detail: response.message,
          life: 3000
        });
  
        if (response.message.includes('Successfully')) {
          this.loadUsers();
        }
      },
      error: (error) => {
        console.error('Error updating user:', error);
  
        const errorMessage = error.error?.message || 'Failed to update user';
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
          life: 3000
        });
      }
    });
  }
  

  addUser(userData: User): void {
    this.dbService.addUser(userData).subscribe({
      next: (response) => {
        this.messageService.add({
          severity: response.message.includes('Successfully') ? 'success' : 'warn',
          summary: response.message.includes('Successfully') ? 'Success' : 'Warning',
          detail: response.message,
          life: 3000
        });

        if (response.message.includes('Successfully')) {
          this.loadUsers();
        }
      },
      error: (error) => {
        console.error('Error adding user:', error);

        const errorMessage = error.error?.message || 'Failed to add user';
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
          life: 3000
        });
      }
    });
  }

  onGlobalFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    // You can implement client-side filtering here if needed
  }

  deleteUser(user: User): void {
    if (!user.user_id) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Cannot delete user: Missing user ID',
        life: 3000
      });
      return;
    }

    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${user.prenom} ${user.nom}?`,
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.dbService.deleteUser(user.user_id!).subscribe({
          next: () => {
            this.users = this.users.filter(u => u.user_id !== user.user_id);
            this.messageService.add({
              severity: 'success',
              summary: 'Successful',
              detail: 'User deleted',
              life: 3000
            });
          },
          error: (error) => {
            console.error('Error deleting user:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to delete user',
              life: 3000
            });
          }
        });
      }
    });
  }
}
