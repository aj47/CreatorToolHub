// Authentication type definitions

export interface User {
  email: string;
  name: string;
  picture: string;
}

export interface AuthSession {
  user: User;
  authenticated: boolean;
  expires?: string;
}

export interface AuthToken {
  email: string;
  name: string;
  picture: string;
  exp: number;
  signOutAfter?: number;
}

export interface AuthError {
  type: 'AUTH_ERROR' | 'NETWORK_ERROR' | 'VALIDATION_ERROR';
  message: string;
  code?: string;
  recoverable: boolean;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: AuthError | null;
  authenticated: boolean;
}

// OAuth related types
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}
