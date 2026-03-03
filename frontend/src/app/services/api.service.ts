import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StorageService } from '../core/services/storage.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);

  // Build full URL for endpoint
  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  // Build request options with auth headers
  private buildOptions(options: object = {}): object {
    const token = this.storage.getAuthToken();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return { headers, ...options };
  }

  get<T>(endpoint: string, options = {}): Observable<T> {
    return this.http.get<T>(this.buildUrl(endpoint), this.buildOptions(options));
  }

  post<T>(endpoint: string, data: unknown, options = {}): Observable<T> {
    return this.http.post<T>(this.buildUrl(endpoint), data, this.buildOptions(options));
  }

  put<T>(endpoint: string, data: unknown, options = {}): Observable<T> {
    return this.http.put<T>(this.buildUrl(endpoint), data, this.buildOptions(options));
  }

  patch<T>(endpoint: string, data: unknown, options = {}): Observable<T> {
    return this.http.patch<T>(this.buildUrl(endpoint), data, this.buildOptions(options));
  }

  delete<T>(endpoint: string, options = {}): Observable<T> {
    return this.http.delete<T>(this.buildUrl(endpoint), this.buildOptions(options));
  }
}