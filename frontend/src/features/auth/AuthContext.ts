import { createContext } from 'react';
import { LoginRequest, UserResponse } from './types';
import { ApiError } from '../../api/types';

export interface AuthContextValue {
  user: UserResponse | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginUser: (credentials: LoginRequest) => Promise<void>;
  logoutUser: () => void;
  error: ApiError | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
