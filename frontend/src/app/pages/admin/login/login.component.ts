import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { ImageModule } from 'primeng/image';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { LoginRequest, User } from '../../../models/models';
import { HttpClient } from '@angular/common/http';
import { DbService } from '../../../services/db.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true, // If you're using standalone components
  imports: [
    CheckboxModule,
    CommonModule,
    InputTextModule,
    ButtonModule,
    ReactiveFormsModule,
    ImageModule,
    FormsModule,
    ToastModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  providers: [MessageService]
})
export class LoginComponent {
  private db = inject(DbService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private authService = inject(AuthService);

  loginForm: FormGroup = new FormGroup({
    email: new FormControl('john.doe@example.com', [Validators.email, Validators.required]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(1),
      // Validators.pattern('^(?=.*[A-Z])(?=.*\\d).+$'),
    ]),
  });
  
  onLogin() {
    if (this.loginForm.invalid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please provide valid email and password',
        life: 3000
      });
      return;
    }
  
    this.db.OnLogin(this.loginForm.value).subscribe({
      next: (response: any) => {
        if (response.user) {
          // Explicitly cast to User type
          const user = response.user as User;
          console.log(user)
          
          // Update auth service with the new user
          this.authService.setCurrentUser(user);
          
          this.messageService.add({
            severity: 'success',
            summary: 'Login',
            detail: 'You are successfully logged in',
            life: 3000
          });
          
          // Navigate based on role
          if (user.role === 'Admin') {
            this.router.navigateByUrl('admin');
          } else {
            this.router.navigateByUrl('');
          }
        } else {
          // Error handling
        }
      },
      error: (error) => {
        // Error handling
      }
    });
  }
}