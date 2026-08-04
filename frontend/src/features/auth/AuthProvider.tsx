import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import type { LoginRequest, UserResponse } from './types';
import { login } from './authApi';
import { ApiError } from '../../api/types';

function getInitialAuth(): { user: UserResponse | null, token: string | null } {
  try {
    const token = sessionStorage.getItem('securewatch.accessToken');
    const userStr = sessionStorage.getItem('securewatch.user');

    if (!token || !userStr) {
      sessionStorage.removeItem('securewatch.accessToken');
      sessionStorage.removeItem('securewatch.user');
      return { user: null, token: null };
    }

    const parsedUser = JSON.parse(userStr);
    if (!parsedUser || typeof parsedUser !== 'object' || !parsedUser.id || !parsedUser.username || !parsedUser.role) {
      sessionStorage.removeItem('securewatch.accessToken');
      sessionStorage.removeItem('securewatch.user');
      return { user: null, token: null };
    }

    return { user: parsedUser as UserResponse, token };
  } catch {
    try {
      sessionStorage.removeItem('securewatch.accessToken');
      sessionStorage.removeItem('securewatch.user');
    } catch {
      // ignore
    }
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => getInitialAuth());
  const [user, setUser] = useState<UserResponse | null>(initial.user);
  const [accessToken, setAccessToken] = useState<string | null>(initial.token);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const loginUser = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await login(credentials);
      setAccessToken(response.access_token);
      setUser(response.user);
      try {
        sessionStorage.setItem('securewatch.accessToken', response.access_token);
        sessionStorage.setItem('securewatch.user', JSON.stringify(response.user));
      } catch {
        // ignore storage errors
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred.',
          details: null
        }));
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logoutUser = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setError(null);
    try {
      sessionStorage.removeItem('securewatch.accessToken');
      sessionStorage.removeItem('securewatch.user');
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = {
    user,
    accessToken,
    isAuthenticated: !!accessToken && !!user,
    isLoading,
    loginUser,
    logoutUser,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
