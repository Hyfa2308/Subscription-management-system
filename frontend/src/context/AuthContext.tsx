/**
 * REVORA – AuthContext
 * Central authentication state and actions for the entire application.
 *
 * On mount: checks for a stored token and fetches /auth/me to restore the session.
 * Provides: user, isAuthenticated, isLoading, login, register, logout, refreshUser.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useReducer,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiLogin, apiRegister, apiLogout, apiGetMe, tokenStorage,
  type LoginResponse,
} from '@/services/authService';
import type { AuthUser, LoginCredentials, RegisterData } from '@/types/auth';
import { ROUTES } from '@/config/routes';

// ── State & reducer ────────────────────────────────────────────────────────────

interface AuthContextState {
  user:            AuthUser | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER';    payload: AuthUser }
  | { type: 'CLEAR_USER' };

function authReducer(state: AuthContextState, action: AuthAction): AuthContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return { user: action.payload, isAuthenticated: true, isLoading: false };
    case 'CLEAR_USER':
      return { user: null, isAuthenticated: false, isLoading: false };
    default:
      return state;
  }
}

const INITIAL_STATE: AuthContextState = {
  user:            null,
  isAuthenticated: false,
  isLoading:       true,  // true on mount — we're checking stored session
};

// ── Context interface ──────────────────────────────────────────────────────────

interface AuthContextValue extends AuthContextState {
  login:       (credentials: LoginCredentials) => Promise<LoginResponse>;
  register:    (data: RegisterData) => Promise<AuthUser>;
  logout:      () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, INITIAL_STATE);
  const navigate = useNavigate();

  // On mount: restore session if valid token exists
  useEffect(() => {
    const restoreSession = async () => {
      const token = tokenStorage.get();
      if (!token) {
        dispatch({ type: 'CLEAR_USER' });
        return;
      }
      try {
        const user = await apiGetMe();
        dispatch({ type: 'SET_USER', payload: user });
      } catch {
        // Token invalid or expired
        tokenStorage.remove();
        dispatch({ type: 'CLEAR_USER' });
      }
    };
    restoreSession();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResponse> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const resp = await apiLogin(credentials);
      tokenStorage.set(resp.access_token);
      dispatch({ type: 'SET_USER', payload: resp.user });
      return resp;
    } catch (err) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw err;
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<AuthUser> => {
    const user = await apiRegister(data);
    return user;
  }, []);

  const logout = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await apiLogout();
    } finally {
      dispatch({ type: 'CLEAR_USER' });
      navigate(ROUTES.LOGIN, { replace: true });
    }
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    try {
      const user = await apiGetMe();
      dispatch({ type: 'SET_USER', payload: user });
    } catch {
      dispatch({ type: 'CLEAR_USER' });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
