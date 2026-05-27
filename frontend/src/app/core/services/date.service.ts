import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateService {
  // Algeria is UTC+1 with no daylight saving time
  private readonly ALGERIA_OFFSET_MS = 60 * 60 * 1000;

  /**
   * Convert a UTC timestamp to Algeria local time (UTC+1).
   * Treats naive ISO strings (no timezone suffix) as UTC.
   */
  private toAlgeriaDate(input: string | Date): Date {
    const utc = input instanceof Date
      ? input
      : new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(input) ? input : input + 'Z');
    return new Date(utc.getTime() + this.ALGERIA_OFFSET_MS);
  }

  /**
   * Format date to DD/MM/YYYY HH:MM format in Algeria time (UTC+1)
   * @param dateInput - Date string or Date object
   * @returns Formatted date string
   */
  formatDate(dateInput: string | Date): string {
    if (!dateInput) return '';

    const date = this.toAlgeriaDate(dateInput);

    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Format date without time in Algeria time (UTC+1)
   * @param dateInput - Date string or Date object
   * @returns Formatted date string (DD/MM/YYYY)
   */
  formatDateOnly(dateInput: string | Date): string {
    if (!dateInput) return '';

    const date = this.toAlgeriaDate(dateInput);

    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
  }

  /**
   * Format time only in Algeria time (UTC+1)
   * @param dateInput - Date string or Date object
   * @returns Formatted time string (HH:MM)
   */
  formatTimeOnly(dateInput: string | Date): string {
    if (!dateInput) return '';

    const date = this.toAlgeriaDate(dateInput);

    if (isNaN(date.getTime())) {
      return 'Invalid Time';
    }

    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  /**
   * Get relative time (e.g., "2 hours ago", "3 days ago")
   * @param dateInput - Date string or Date object
   * @returns Relative time string
   */
  getRelativeTime(dateInput: string | Date): string {
    if (!dateInput) return '';

    const utcDate = dateInput instanceof Date
      ? dateInput
      : new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(dateInput) ? dateInput : dateInput + 'Z');

    const now = new Date();
    const diffMs = now.getTime() - utcDate.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return this.formatDate(dateInput);
  }

  /**
   * Parse date string to Date object (treats naive strings as UTC)
   * @param dateString - Date string in various formats
   * @returns Date object
   */
  parseDate(dateString: string): Date {
    return new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(dateString) ? dateString : dateString + 'Z');
  }

  /**
   * Check if date is today in Algeria time (UTC+1)
   * @param dateInput - Date string or Date object
   * @returns boolean
   */
  isToday(dateInput: string | Date): boolean {
    const algeriaDate = this.toAlgeriaDate(dateInput);
    const algeriaToday = new Date(Date.now() + this.ALGERIA_OFFSET_MS);

    return algeriaDate.getUTCDate() === algeriaToday.getUTCDate() &&
           algeriaDate.getUTCMonth() === algeriaToday.getUTCMonth() &&
           algeriaDate.getUTCFullYear() === algeriaToday.getUTCFullYear();
  }

  /**
   * Check if date is in the past (UTC comparison)
   * @param dateInput - Date string or Date object
   * @returns boolean
   */
  isPast(dateInput: string | Date): boolean {
    const utcDate = dateInput instanceof Date
      ? dateInput
      : new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(dateInput) ? dateInput : dateInput + 'Z');
    return utcDate < new Date();
  }

  /**
   * Get days remaining until a future date (UTC comparison)
   * @param dateInput - Date string or Date object
   * @returns Number of days remaining (can be negative if date is past)
   */
  getDaysRemaining(dateInput: string | Date): number {
    const utcDate = dateInput instanceof Date
      ? dateInput
      : new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(dateInput) ? dateInput : dateInput + 'Z');
    const now = new Date();
    const diffMs = utcDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}
