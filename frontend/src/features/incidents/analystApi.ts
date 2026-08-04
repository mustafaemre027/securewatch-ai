import { apiClient } from '../../api/client';
import { ApiError } from '../../api/types';
import type { UserResponse, UserRole } from '../auth/types';

function isValidRole(role: unknown): role is UserRole {
  return role === 'ADMIN' || role === 'ANALYST';
}

function isValidUser(user: unknown): user is UserResponse {
  if (typeof user !== 'object' || user === null) {
    return false;
  }

  const u = user as Record<string, unknown>;

  if (typeof u.id !== 'number' || u.id <= 0 || !Number.isInteger(u.id)) {
    return false;
  }

  if (typeof u.username !== 'string' || u.username.trim() === '') {
    return false;
  }

  if (typeof u.email !== 'string') {
    return false;
  }

  if (!isValidRole(u.role)) {
    return false;
  }

  if (typeof u.created_at !== 'string') {
    return false;
  }

  return true;
}

function validateUsersResponse(data: unknown): UserResponse[] {
  if (!Array.isArray(data)) {
    throw new ApiError(500, { code: 'INVALID_USERS_RESPONSE', message: 'Geçersiz kullanıcı listesi yanıtı.', details: null });
  }

  const seenIds = new Set<number>();

  for (const item of data) {
    if (!isValidUser(item)) {
      throw new ApiError(500, { code: 'INVALID_USERS_RESPONSE', message: 'Kullanıcı verisi beklenen formatta değil.', details: null });
    }
    
    if (seenIds.has(item.id)) {
      throw new ApiError(500, { code: 'INVALID_USERS_RESPONSE', message: 'Tekrarlayan kullanıcı kimliği bulundu.', details: null });
    }
    seenIds.add(item.id);
  }

  return data;
}

export async function listAssignableAnalysts(
  token: string,
  signal: AbortSignal
): Promise<UserResponse[]> {
  const data = await apiClient<unknown>('/users?skip=0&limit=100', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  const validUsers = validateUsersResponse(data);

  const analysts = validUsers.filter((user) => user.role === 'ANALYST');

  return analysts.sort((a, b) => {
    // Locale-independent string comparison
    const nameA = a.username.toUpperCase();
    const nameB = b.username.toUpperCase();
    
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    
    // If usernames are equal (ignoring case), sort by ID ascending
    return a.id - b.id;
  });
}
