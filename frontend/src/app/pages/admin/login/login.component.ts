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

@Component({
  selector: 'app-login',
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
  providers :[MessageService]
})
export class LoginComponent {
  // loginRequest: LoginRequest = {
  //   email: '',
  //   password: ''
  // }
  private db = inject(DbService);
  private messageService = inject(MessageService)

  loginForm: FormGroup = new FormGroup({
    email: new FormControl('john.doe@example.com', [Validators.email, Validators.required]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(1),
      // Validators.pattern('^(?=.*[A-Z])(?=.*\\d).+$'),
    ]),
  });

  http = inject(HttpClient);
  onLogin() {
    console.log(this.loginForm.value);
    this.db.OnLogin(this.loginForm.value).subscribe({
      next: (response) => {
        localStorage.setItem('user', JSON.stringify(response))
        console.log('response', response)
        // Call success callback if provided
          this.messageService.add({
            severity: 'success',
            summary: 'Login',
            detail: 'You are successfully Log In ',
            life: 3000
          });
      },
      error: (error) => {
        console.error('Error adding record:', error);
            this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to add record. Please contact the  support team.',
            life: 3000
          });
      },
    });
  }
}
