import { ReactNode, useState, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { LoginRequest, UserResponse } from './types';
import { login } from './authApi';
import { ApiError } from '../../api/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const loginUser = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await login(credentials);
      setAccessToken(response.access_token);
      setUser(response.user);
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
