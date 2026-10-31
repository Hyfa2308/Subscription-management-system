/**
 * REVORA – Auth API service.
 * Thin wrapper around apiClient for all /auth endpoints.
 * Token is stored in localStorage as 'revora_token'.
 *
 * Security note: localStorage is used for demo/hackathon simplicity.
 * In production, prefer HttpOnly cookies with a refresh-token rotation strategy.
 */

import apiClient from './apiClient';
import type { AuthUser, LoginCredentials, RegisterData } from '@/types/auth';

const TOKEN_KEY = 'revora_token';

// ── Token helpers ──────────────────────────────────────────────────────────────

export const tokenStorage = {
  get:    ()      => localStorage.getItem(TOKEN_KEY),
  set:    (t: string) => localStorage.setItem(TOKEN_KEY, t),
  remove: ()      => localStorage.removeItem(TOKEN_KEY),
};

// ── Axios request interceptor – attach token ───────────────────────────────────

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Axios response interceptor – handle 401 ────────────────────────────────────

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Clear stale token; AuthContext will redirect to /login
      tokenStorage.remove();
    }
    return Promise.reject(err);
  },
);

// ── API calls ──────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type:   string;
  user:         AuthUser;
}

export async function apiLogin(credentials: LoginCredentials): Promise<LoginResponse> {
  const resp = await apiClient.post<LoginResponse>('/auth/login', credentials);
  return resp.data;
}

export async function apiRegister(data: RegisterData): Promise<AuthUser> {
  const resp = await apiClient.post<AuthUser>('/auth/register', data);
  return resp.data;
}

export async function apiGetMe(): Promise<AuthUser> {
  const resp = await apiClient.get<{ user: AuthUser }>('/auth/me');
  return resp.data.user;
}

export async function apiLogout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    tokenStorage.remove();
  }
}

export async function apiForgotPassword(email: string): Promise<{ message: string; dev_reset_token?: string }> {
  const resp = await apiClient.post('/auth/forgot-password', { email });
  return resp.data;
}

export async function apiResetPassword(token: string, new_password: string, confirm_password: string): Promise<{ message: string }> {
  const resp = await apiClient.post('/auth/reset-password', { token, new_password, confirm_password });
  return resp.data;
}
