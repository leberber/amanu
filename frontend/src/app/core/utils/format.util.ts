/**
 * Formatting utility functions
 * Contains shared formatting logic for phone numbers, initials, etc.
 */

import { VALIDATION } from '../constants/validation.constants';

/**
 * Phone number segment lengths for Algeria format (0xxx xx xx xx)
 */
const PHONE_SEGMENT_BREAKS = [4, 6, 8] as const;

/**
 * Formats a phone number in Algeria format: 0xxx xx xx xx
 * @param value - The phone number to format (can contain non-digit characters)
 * @param maxLength - Maximum number of digits to include (defaults to VALIDATION.MIN_PHONE_LENGTH)
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(value: string | null | undefined, maxLength = VALIDATION.MIN_PHONE_LENGTH): string {
  if (!value) return '';

  // Remove all non-digits
  const digits = value.replace(/\D/g, '');

  // Limit to max length
  const limited = digits.slice(0, maxLength);

  // Format as 0xxx xx xx xx
  if (limited.length <= PHONE_SEGMENT_BREAKS[0]) {
    return limited;
  } else if (limited.length <= PHONE_SEGMENT_BREAKS[1]) {
    return `${limited.slice(0, 4)} ${limited.slice(4)}`;
  } else if (limited.length <= PHONE_SEGMENT_BREAKS[2]) {
    return `${limited.slice(0, 4)} ${limited.slice(4, 6)} ${limited.slice(6)}`;
  } else {
    return `${limited.slice(0, 4)} ${limited.slice(4, 6)} ${limited.slice(6, 8)} ${limited.slice(8, 10)}`;
  }
}

/**
 * Extracts initials from a full name
 * @param name - The full name to extract initials from
 * @param fallback - Fallback character if name is empty (defaults to 'U')
 * @returns Up to 2 characters representing the initials
 */
export function getInitials(name: string | null | undefined, fallback = 'U'): string {
  const trimmed = name?.trim();
  if (!trimmed) return fallback;

  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);

  if (parts.length >= 2) {
    // Use first letter of first two words
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  // Single word - use first two characters
  return trimmed.substring(0, 2).toUpperCase();
}

/**
 * Generates a random ID string for use in element IDs
 * @param prefix - Prefix for the ID (e.g., 'map-', 'btn-')
 * @returns A unique ID string
 */
export function generateRandomId(prefix = ''): string {
  return `${prefix}${Math.random().toString(36).substring(2, 9)}`;
}
