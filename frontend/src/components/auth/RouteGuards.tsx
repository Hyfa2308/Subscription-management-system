/**
 * REVORA – Route Guards.
 * ProtectedRoute   – requires authentication
 * PublicRoute      – redirects authenticated users away from login/register
 * RoleRoute        – requires specific roles
 * UnauthorizedPage – 403 page
 */

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';
import type { UserRole } from '@/types/auth';
import { cn } from '@/utils/cn';

// ── Loading spinner ────────────────────────────────────────────────────────────

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading your session…</p>
      </div>
    </div>
  );
}

// ── ProtectedRoute ─────────────────────────────────────────────────────────────
/**
 * Redirects unauthenticated users to /login.
 * Saves the attempted location so login can redirect back after success.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// ── PublicRoute ────────────────────────────────────────────────────────────────
/**
 * Redirects authenticated users away from login/register to the dashboard.
 */
export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AuthLoading />;

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}

// ── RoleRoute ──────────────────────────────────────────────────────────────────
/**
 * Restricts access to users with one of the allowed roles.
 * Shows a 403 page for unauthorized users.
 */
export function RoleRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <UnauthorizedPage />;
  }

  return <Outlet />;
}

// ── 403 Unauthorized Page ──────────────────────────────────────────────────────

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <ShieldOff className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">403</h1>
        <h2 className="text-lg font-semibold text-slate-700 mb-3">Access Denied</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          You do not have permission to access this page. Contact your administrator if you believe this is an error.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
