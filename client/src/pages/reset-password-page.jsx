import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password cannot exceed 72 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  // The emailed link carries the token in the URL fragment (#token=...) so it is never sent to
  // servers or analytics. Read it once, then drop it from the address bar and history.
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
    return value;
  });
  const hasValidToken = /^[a-f0-9]{64}$/.test(token);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await resetPassword(token, data.password);
      navigate('/feed');
    } catch (err) {
      toast.error(err.message || 'Could not reset your password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-ink py-16 sm:py-24 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-7 sm:p-8 space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Choose a new password
          </h1>
          <p className="text-xs text-ink-muted leading-relaxed">
            You'll be signed out on every other device once it's changed.
          </p>
        </div>

        {hasValidToken ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-password" className="text-xs font-bold uppercase tracking-wider text-ink block">
                New password <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  autoComplete="new-password"
                  {...register('password')}
                  placeholder="At least 8 characters"
                  hasError={!!errors.password}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reset-confirm-password" className="text-xs font-bold uppercase tracking-wider text-ink block">
                Confirm password <span className="text-danger">*</span>
              </label>
              <Input
                id="reset-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('confirmPassword')}
                placeholder="••••••••"
                hasError={!!errors.confirmPassword}
                className="h-11"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-danger">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full rounded-[8px] font-semibold text-sm h-11">
              Update password
            </Button>
          </form>
        ) : (
          <p role="alert" className="text-xs text-danger bg-danger-soft border border-danger rounded-[8px] px-3 py-2.5">
            This reset link is invalid or incomplete. Request a new one below.
          </p>
        )}

        <div className="text-xs text-ink-muted pt-3 border-t border-border text-center">
          Need a new link?{' '}
          <Link to="/forgot-password" className="font-semibold text-accent-strong hover:underline">
            Request password reset
          </Link>
        </div>
      </div>
    </main>
  );
}
