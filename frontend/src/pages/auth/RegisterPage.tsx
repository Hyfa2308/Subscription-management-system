/**
 * REVORA – Register Page
 * Professional registration with React Hook Form + Zod.
 * No role selector — public registration always assigns CUSTOMER role.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/utils/cn';

// ── Validation schema ──────────────────────────────────────────────────────────

const registerSchema = z.object({
  full_name:        z.string().min(2, 'Full name must be at least 2 characters').max(200),
  email:            z.string().min(1, 'Email is required').email('Enter a valid email address'),
  phone:            z.string().max(30).optional(),
  password:         z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit'),
  confirm_password: z.string(),
  terms:            z.literal(true, { error: 'You must accept the terms' }),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path:    ['confirm_password'],
});

type RegisterForm = z.infer<typeof registerSchema>;

// ── Password strength helper ───────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'One uppercase letter',  ok: /[A-Z]/.test(password) },
    { label: 'One digit',             ok: /[0-9]/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      {checks.map(c => (
        <div key={c.label} className="flex items-center gap-1.5">
          <div className={cn('w-3 h-3 rounded-full', c.ok ? 'bg-emerald-500' : 'bg-slate-200')} />
          <span className={cn('text-xs', c.ok ? 'text-emerald-700' : 'text-slate-400')}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const [showPassword,  setShowPassword]  = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [serverError,   setServerError]   = useState('');
  const [registered,    setRegistered]    = useState(false);

  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const passwordValue = watch('password', '');

  const onSubmit = async (data: RegisterForm) => {
    setServerError('');
    try {
      await registerUser({
        full_name:        data.full_name,
        email:            data.email,
        phone:            data.phone,
        password:         data.password,
        confirm_password: data.confirm_password,
      });
      setRegistered(true);
      setTimeout(() => navigate(ROUTES.LOGIN), 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Registration failed. Please try again.';
      setServerError(msg);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Account created!</h2>
          <p className="text-sm text-slate-500">Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">REVORA</span>
        </div>

        <div className="card p-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
            <p className="text-sm text-slate-500 mt-1">
              Join REVORA as a Customer.{' '}
              <span className="text-slate-400 text-xs">(Admin accounts are provisioned separately.)</span>
            </p>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Full name */}
            <div>
              <label htmlFor="full_name" className="form-label">Full name <span className="text-red-500">*</span></label>
              <input
                id="full_name" type="text" autoComplete="name"
                placeholder="Jane Smith"
                className={cn('form-input', errors.full_name && 'border-red-400')}
                {...register('full_name')}
              />
              {errors.full_name && <p className="form-error">{errors.full_name.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg_email" className="form-label">Email address <span className="text-red-500">*</span></label>
              <input
                id="reg_email" type="email" autoComplete="email"
                placeholder="jane@example.com"
                className={cn('form-input', errors.email && 'border-red-400')}
                {...register('email')}
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="form-label">Phone <span className="text-slate-400 text-xs font-normal">(optional)</span></label>
              <input
                id="phone" type="tel" autoComplete="tel"
                placeholder="+1 555 000 0000"
                className="form-input"
                {...register('phone')}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg_password" className="form-label">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  id="reg_password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 8 chars, 1 uppercase, 1 digit"
                  className={cn('form-input pr-10', errors.password && 'border-red-400')}
                  {...register('password')}
                />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide' : 'Show'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={passwordValue} />
              {errors.password && <p className="form-error mt-1">{errors.password.message}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm_password" className="form-label">Confirm password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  id="confirm_password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={cn('form-input pr-10', errors.confirm_password && 'border-red-400')}
                  {...register('confirm_password')}
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirm ? 'Hide' : 'Show'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                id="terms" type="checkbox"
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                {...register('terms')}
              />
              <label htmlFor="terms" className="text-sm text-slate-600 cursor-pointer">
                I agree to the{' '}
                <a href="#" className="text-indigo-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-indigo-600 hover:underline">Privacy Policy</a>
              </label>
            </div>
            {errors.terms && <p className="form-error -mt-2">{errors.terms.message}</p>}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary btn w-full flex items-center justify-center gap-2"
            >
              {isSubmitting
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Create Account'
              }
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} className="text-indigo-600 hover:text-indigo-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
