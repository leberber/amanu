// src/app/models/user.model.ts
import { USER_ROLES } from '../core/constants/app.constants';

// Derive UserRole type from USER_ROLES constant - single source of truth
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Re-export for backward compatibility (components using UserRole.ADMIN, etc.)
export const UserRole = USER_ROLES;

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  store_name?: string;
  wilaya?: string;
  daira?: string;
  commune?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  role?: UserRole;
}