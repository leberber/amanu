import { USER_ROLES } from '../core/constants/user.constants';

// Derive UserRole type from USER_ROLES constant - single source of truth
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];


export const UserRole = USER_ROLES;

// Auth provider enum
export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google'
}

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
  auth_provider: AuthProvider;
  profile_picture?: string;
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

// Google OAuth types
export interface GoogleAuthRequest {
  credential: string;
}

export interface GoogleAuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  is_new_user: boolean;
  profile_complete: boolean;
}