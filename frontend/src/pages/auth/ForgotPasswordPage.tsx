/**
 * REVORA – Forgot Password Page
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sparkles, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { apiForgotPassword } from '@/services/authService';
import { ROUTES } from '@/config/routes';
import { cn } from '@/utils/cn';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});
type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted,  setSubmitted]  = useState(false);
  const [devToken,   setDevToken]   = useState('');
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ForgotForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: ForgotForm) => {
    setServerError('');
    try {
      const resp = await apiForgotPassword(data.email);
      if (resp.dev_reset_token) setDevToken(resp.dev_reset_token);
      setSubmitted(true);
    } catch {
      setServerError('Something went wrong. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            If an account with that email exists, a password-reset link has been sent.
            Check your inbox and follow the instructions.
          </p>

          {/* DEV-ONLY reset token display */}
          {devToken && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
              <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ DEV MODE: Reset Token</p>
              <p className="text-xs text-amber-600 break-all font-mono">{devToken}</p>
              <Link
                to={`${ROUTES.RESET_PASSWORD}?token=${encodeURIComponent(devToken)}`}
                className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
              >
                Click here to reset password →
              </Link>
            </div>
          )}

          <Link to={ROUTES.LOGIN} className="btn-secondary btn inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </div>
    );
  }

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
            <Mail className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Forgot your password?</h1>
          <p className="text-sm text-slate-500 mb-6">
            Enter your email address and we'll send you a reset link.
          </p>

          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="fp_email" className="form-label">Email address</label>
              <input
                id="fp_email" type="email" autoComplete="email"
                placeholder="you@example.com"
                className={cn('form-input', errors.email && 'border-red-400')}
                {...register('email')}
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting}
              className="btn-primary btn w-full flex items-center justify-center gap-2">
              {isSubmitting
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Send reset link'
              }
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to={ROUTES.LOGIN}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
