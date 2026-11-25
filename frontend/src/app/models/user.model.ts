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
  h3_index?: string;
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

/**
 * Existing user: access_token + user are set.
 * New user: no account exists yet; signup_token + Google profile are set,
 * and registration must be finished via /auth/google/register.
 */
export interface GoogleAuthResponse {
  access_token: string | null;
  token_type: string;
  user: User | null;
  is_new_user: boolean;
  profile_complete: boolean;
  signup_token: string | null;
  email: string | null;
  full_name: string | null;
  profile_picture: string | null;
}

export interface PendingGoogleSignup {
  signup_token: string;
  email: string;
  full_name: string;
}

export interface GoogleRegisterRequest {
  signup_token: string;
  full_name: string;
  phone: string;
  store_name?: string | null;
  segment_id?: number | null;
  address?: string;
  wilaya?: string;
  daira?: string;
  commune?: string;
  latitude?: number;
  longitude?: number;
}