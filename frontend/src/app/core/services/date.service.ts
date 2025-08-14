import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateService {
  
  /**
   * Format date to DD/MM/YYYY HH:MM format as specified in CLAUDE.md
   * @param dateInput - Date string or Date object
   * @returns Formatted date string
   */
  formatDate(dateInput: string | Date): string {
    if (!dateInput) return '';
    
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  
  /**
   * Format date without time
   * @param dateInput - Date string or Date object
   * @returns Formatted date string (DD/MM/YYYY)
   */
  formatDateOnly(dateInput: string | Date): string {
    if (!dateInput) return '';
    
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }
  
  /**
   * Format time only
   * @param dateInput - Date string or Date object
   * @returns Formatted time string (HH:MM)
   */
  formatTimeOnly(dateInput: string | Date): string {
    if (!dateInput) return '';
    
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    
    if (isNaN(date.getTime())) {
      return 'Invalid Time';
    }
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes}`;
  }
  
  /**
   * Get relative time (e.g., "2 hours ago", "3 days ago")
   * @param dateInput - Date string or Date object
   * @returns Relative time string
   */
  getRelativeTime(dateInput: string | Date): string {
    if (!dateInput) return '';
    
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return this.formatDate(date);
  }
  
  /**
   * Parse date string to Date object
   * @param dateString - Date string in various formats
   * @returns Date object
   */
  parseDate(dateString: string): Date {
    return new Date(dateString);
  }
  
  /**
   * Check if date is today
   * @param dateInput - Date string or Date object
   * @returns boolean
   */
  isToday(dateInput: string | Date): boolean {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const today = new Date();
    
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }
  
  /**
   * Check if date is in the past
   * @param dateInput - Date string or Date object
   * @returns boolean
   */
  isPast(dateInput: string | Date): boolean {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date < new Date();
  }
}