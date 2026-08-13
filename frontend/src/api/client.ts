import { ApiError } from './types';
import type { ApiErrorDetail } from './types';

// Vercel'deki ortam değişkenini okur, yoksa boş kalır (local için)
const BASE_URL = import.meta.env.VITE_API_URL || '';
const API_PREFIX = `${BASE_URL}/api/v1`;

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiClient<T>(
  path: string,
  options: FetchOptions = {},
  token?: string | null
): Promise<T> {
  const url = `${API_PREFIX}${path}`;

  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    body: options.body !== undefined
      ? (options.body instanceof FormData ? options.body : JSON.stringify(options.body))
      : undefined,
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'A network error occurred while communicating with the server.',
      details: null,
    });
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      // Ignored if JSON parsing fails
    }
  }

  if (!response.ok) {
    let errorDetail: ApiErrorDetail = {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred.',
      details: null,
    };

    if (data && typeof data === 'object' && 'error' in data) {
      const apiResp = data as { error?: Partial<ApiErrorDetail> };
      if (apiResp.error && typeof apiResp.error.message === 'string') {
        errorDetail = {
          code: apiResp.error.code || errorDetail.code,
          message: apiResp.error.message,
          details: apiResp.error.details ?? null,
        };
      }
    } else if (!data) {
      errorDetail.message = `HTTP Error ${response.status}: ${response.statusText}`;
    }

    throw new ApiError(response.status, errorDetail);
  }

  return data as T;
}
