import { apiClient } from '../../api/client';
import type { LoginRequest, TokenResponse } from './types';

export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  return apiClient<TokenResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}