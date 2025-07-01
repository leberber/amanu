// src/app/services/auth.service.ts - Fix login flow
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap, switchMap } from 'rxjs';
import { ApiService } from './api.service';
import { LoginRequest, LoginResponse, RegisterRequest, User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  constructor(private apiService: ApiService) {
    this.loadStoredUser();
  }
  
  // Fixed login flow to properly update current user
  login(credentials: LoginRequest): Observable<User> {
    // Use URLSearchParams for OAuth2 password flow
    const body = new URLSearchParams();
    body.set('username', credentials.username);
    body.set('password', credentials.password);
    
    const options = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    
    return this.apiService.post<LoginResponse>('/auth/login', body.toString(), options).pipe(
      tap(response => {
        localStorage.setItem('token', response.access_token);
      }),
      // Chain the user loading after successful token acquisition
      switchMap(() => this.loadCurrentUser())
    );
  }
  
  register(userData: RegisterRequest): Observable<User> {
    return this.apiService.post<User>('/auth/register', userData);
  }
  
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }
  
  loadCurrentUser(): Observable<User> {
    return this.apiService.get<User>('/users/me').pipe(
      tap(user => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
  }
  
  private loadStoredUser(): void {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      try {
        this.currentUserSubject.next(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing stored user:', e);
        this.logout(); // Clear invalid data
      }
    }
  }
  
  get isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }
  
  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }
}