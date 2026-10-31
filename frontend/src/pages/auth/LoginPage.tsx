/**
 * REVORA – Premium Login Page
 * Two-column desktop layout with animated gradient left panel + clean right form.
 */

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Sparkles, ArrowRight, Zap, BarChart2, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/utils/cn';

// ── Validation schema ──────────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

// ── Feature pills ──────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Zap,      label: 'Automated Billing' },
  { icon: BarChart2,label: 'Revenue Intelligence' },
  { icon: Shield,   label: 'Churn Prevention' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = (location.state as any)?.from?.pathname || ROUTES.DASHBOARD;

  const [showPassword, setShowPassword] = useState(false);
  const [serverError,  setServerError]  = useState('');

  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Sign in failed. Please check your credentials.';
      setServerError(msg);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden px-12 py-10"
        style={{
          background: 'linear-gradient(135deg, #14213D 0%, #1e3461 40%, #312e81 70%, #0f172a 100%)',
        }}
      >
        {/* Geometric decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-24 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full" />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">REVORA</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <p className="text-indigo-300 text-sm font-semibold uppercase tracking-widest mb-4">
            Brightloop Software
          </p>
          <h1 className="text-4xl font-bold text-white leading-tight mb-5 text-balance">
            Manage subscriptions.<br />
            Automate billing.<br />
            <span className="text-indigo-300">Protect revenue.</span>
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-8 max-w-sm">
            REVORA is the complete subscription management and revenue intelligence platform
            built for modern SaaS businesses.
          </p>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-indigo-300" />
                </div>
                <span className="text-slate-300 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-slate-500 text-xs">© 2024 Brightloop Software · REVORA Platform</p>
        </div>
      </div>

      {/* ── Right panel – login form ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-[#F8FAFC]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">REVORA</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in to your REVORA account</p>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="form-label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@brightloop.io"
                className={cn('form-input', errors.email && 'border-red-400 focus:ring-red-400')}
                {...register('email')}
              />
              {errors.email && (
                <p className="form-error">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="form-label mb-0">Password</label>
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn('form-input pr-10', errors.password && 'border-red-400 focus:ring-red-400')}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary btn w-full mt-2 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to={ROUTES.REGISTER} className="text-indigo-600 hover:text-indigo-700 font-medium">
              Create account
            </Link>
          </p>

          {/* Dev credentials hint */}
          <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 font-medium mb-1">Development credentials</p>
            <p className="text-xs text-amber-600">Email: admin@brightloop.io</p>
            <p className="text-xs text-amber-600">Password: Revora@2024</p>
          </div>
        </div>
      </div>
    </div>
  );
}
