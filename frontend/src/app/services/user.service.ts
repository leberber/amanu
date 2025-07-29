// src/app/services/user.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { User } from '../models/user.model';

interface UpdateProfileData {
  full_name: string;
  phone?: string;
  address?: string;
}

interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private apiService: ApiService) {}
  
  updateProfile(data: UpdateProfileData): Observable<User> {
    return this.apiService.patch<User>('/users/me', data);
  }
  
  changePassword(data: ChangePasswordData): Observable<void> {
    return this.apiService.post<void>('/users/change-password', data);
  }
  
  getCurrentUser(): Observable<User> {
    return this.apiService.get<User>('/users/me');
  }
}