// User types
export interface User {
  id: string;
  phone: string;
  name: string;
  monthly_income_ghs: number | null;
  preferred_language: 'en' | 'tw' | 'ee' | 'dag';
  onboarding_completed: 0 | 1;
  created_at: string;
  updated_at: string;
}

// Publicly safe user (returned from auth endpoints)
export type PublicUser = Pick<User, 'id' | 'name' | 'phone'>;

// Auth method types
export type AuthMethodType = 'pin' | 'webauthn' | 'otp' | 'google' | 'apple';

export interface AuthMethod {
  id: string;
  user_id: string;
  type: AuthMethodType;
  credential: string; // JSON string
  is_primary: 0 | 1;
  created_at: string;
}

// PIN credential stored as JSON in auth_methods.credential
export interface PinCredential {
  hash: string; // base64
  salt: string; // base64
}

// Account types
export type AccountType = 'momo' | 'bank' | 'cash' | 'susu';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  provider: string | null;
  account_number: string | null;
  balance_ghs: number;
  is_primary: 0 | 1;
  created_at: string;
}

// API response envelope
export interface ApiSuccess<T> {
  data: T;
  meta?: { total?: number; page?: number };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Auth responses
export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface RefreshResponse {
  accessToken: string;
}
