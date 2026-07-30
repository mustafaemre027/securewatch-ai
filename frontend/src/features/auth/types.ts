export type UserRole = 'ADMIN' | 'ANALYST';

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface LoginRequest {
  username: string;
  password: string;
}
