/**
 * REVORA – Reset Password Page
 * Reads token from URL query param ?token=...
 */

import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Sparkles, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiResetPassword } from '@/services/authService';
import { ROUTES } from '@/config/routes';
import { cn } from '@/utils/cn';

const schema = z.object({
  new_password:     z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter required')
    .regex(/[0-9]/, 'One digit required'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path:    ['confirm_password'],
});
type ResetForm = z.infer<typeof schema>;

function StrengthDot({ ok }: { ok: boolean }) {
  return <div className={cn('w-3 h-3 rounded-full', ok ? 'bg-emerald-500' : 'bg-slate-200')} />;
}

export default function ResetPasswordPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get('token') || '';

  const [showPass,   setShowPass]   = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<ResetForm>({ resolver: zodResolver(schema) });

  const pwd = watch('new_password', '');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Invalid reset link</h2>
          <p className="text-sm text-slate-500 mb-4">This link is missing the reset token. Please request a new one.</p>
          <Link to={ROUTES.FORGOT_PASSWORD} className="btn-primary btn">Request new link</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
        <div className="text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Password reset!</h2>
          <p className="text-sm text-slate-500 mb-5">Your password has been changed. You can now sign in.</p>
          <Link to={ROUTES.LOGIN} className="btn-primary btn">Sign in</Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: ResetForm) => {
    setServerError('');
    try {
      await apiResetPassword(token, data.new_password, data.confirm_password);
      setSuccess(true);
    } catch (err: any) {
      setServerError(err?.response?.data?.detail || 'Reset failed. The link may have expired.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900">REVORA</span>
        </div>

        <div className="card p-8">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-5">
            <KeyRound className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Set new password</h1>
          <p className="text-sm text-slate-500 mb-6">Choose a strong password for your account.</p>

          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="new_password" className="form-label">New password</label>
              <div className="relative">
                <input
                  id="new_password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min. 8 chars"
                  className={cn('form-input pr-10', errors.new_password && 'border-red-400')}
                  {...register('new_password')}
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwd && (
                <div className="mt-2 space-y-1">
                  {[
                    { label: '8+ characters', ok: pwd.length >= 8 },
                    { label: 'Uppercase letter', ok: /[A-Z]/.test(pwd) },
                    { label: 'Digit', ok: /[0-9]/.test(pwd) },
                  ].map(c => (
                    <div key={c.label} className="flex items-center gap-1.5">
                      <StrengthDot ok={c.ok} />
                      <span className={cn('text-xs', c.ok ? 'text-emerald-700' : 'text-slate-400')}>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {errors.new_password && <p className="form-error mt-1">{errors.new_password.message}</p>}
            </div>

            <div>
              <label htmlFor="confirm_password" className="form-label">Confirm password</label>
              <div className="relative">
                <input
                  id="confirm_password"
                  type={showConf ? 'text' : 'password'}
                  placeholder="Repeat password"
                  className={cn('form-input pr-10', errors.confirm_password && 'border-red-400')}
                  {...register('confirm_password')}
                />
                <button type="button" onClick={() => setShowConf(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting}
              className="btn-primary btn w-full flex items-center justify-center gap-2">
              {isSubmitting
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Reset password'
              }
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to={ROUTES.LOGIN} className="text-sm text-slate-500 hover:text-slate-700">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
