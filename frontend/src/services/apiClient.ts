/**
 * REVORA – Axios instance with request/response interceptors.
 * All API calls should use this instance.
 */

import axios, { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/config/app';

// ── Axios instance ─────────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request interceptor – attach auth token ────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('revora_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor – normalise errors ────────────────────────────────────

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      // Clear stale token and reload
      localStorage.removeItem('revora_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  },
);

// ── Typed API error ────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Array<{ field?: string; message: string }>;
  status_code: number;
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.error) return data.error;
    if (error.message === 'Network Error')
      return 'Cannot reach the REVORA backend. Please check your connection.';
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
  }
  return 'An unexpected error occurred.';
}

export default apiClient;
