// src/app/services/api.service.ts - Fix token name inconsistency
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Helper method to get auth headers
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token'); // Changed from 'auth_token' to 'token'
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  get<T>(endpoint: string, options = {}): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestOptions = {
      headers: this.getHeaders(),
      ...options
    };
    return this.http.get<T>(url, requestOptions);
  }

  post<T>(endpoint: string, data: any, options = {}): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestOptions = {
      headers: this.getHeaders(),
      ...options
    };
    return this.http.post<T>(url, data, requestOptions);
  }

  put<T>(endpoint: string, data: any, options = {}): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestOptions = {
      headers: this.getHeaders(),
      ...options
    };
    return this.http.put<T>(url, data, requestOptions);
  }

  patch<T>(endpoint: string, data: any, options = {}): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestOptions = {
      headers: this.getHeaders(),
      ...options
    };
    return this.http.patch<T>(url, data, requestOptions);
  }

  delete<T>(endpoint: string, options = {}): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestOptions = {
      headers: this.getHeaders(),
      ...options
    };
    return this.http.delete<T>(url, requestOptions);
  }
}