import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OAuthButtons, oauthErrorMessage } from '@/components/oauth-buttons';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

// Demo accounts use a public password, so the shortcut panel is for local development only.
const SHOW_DEMO_LOGINS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true';

const schema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRedirect = searchParams.get('redirect') || '';
  // Only same-site paths: "//evil.com" or "https://..." would turn this into an open redirect.
  const redirectPath = /^\/(?![/\\])/.test(requestedRedirect) ? requestedRedirect : '/feed';
  const oauthError = oauthErrorMessage(searchParams.get('error'));

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      navigate(redirectPath);
    } catch (err) {
      toast.error(err.message || 'Incorrect email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = (email, password = 'password123') => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', password, { shouldValidate: true });
  };

  return (
    <main className="min-h-screen bg-bg text-ink py-16 sm:py-24 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-7 sm:p-8 space-y-6">
        {/* Header */}
        <div className="space-y-1.5 text-center">
          <div className="w-10 h-10 rounded-[10px] bg-accent-strong text-accent-ink mx-auto flex items-center justify-center select-none mb-3">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Sign in to BusinessListe
          </h1>
          <p className="text-xs text-ink-muted leading-relaxed">
            Enter your email to rate ideas, post feedback, or share new concepts.
          </p>
        </div>

        {oauthError && (
          <p role="alert" className="text-xs text-danger bg-danger-soft border border-danger rounded-[8px] px-3 py-2.5">
            {oauthError}
          </p>
        )}

        <OAuthButtons redirectPath={redirectPath} />

        {/* 1-Click Demo Logins */}
        {SHOW_DEMO_LOGINS && (
        <div className="p-3 bg-surface-muted rounded-[8px] border border-border space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block text-center">
            Demo quick logins
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoFill('admin@ideapulse.dev')}
              className="p-2 rounded-[6px] border border-border bg-surface text-ink hover:border-accent-strong transition-colors text-left"
            >
              <strong className="block text-accent-strong font-bold text-xs">Elena</strong>
              <span className="text-[10px] text-ink-muted">Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill('marcus@techventures.io')}
              className="p-2 rounded-[6px] border border-border bg-surface text-ink hover:border-accent-strong transition-colors text-left"
            >
              <strong className="block text-ink font-bold text-xs">Marcus</strong>
              <span className="text-[10px] text-ink-muted">Builder</span>
            </button>
          </div>
        </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-xs font-bold uppercase tracking-wider text-ink block">
              Email <span className="text-danger">*</span>
            </label>
            <Input
              id="login-email"
              type="email"
              autoFocus
              autoComplete="email"
              {...register('email')}
              placeholder="you@example.com"
              hasError={!!errors.email}
              className="h-11"
            />
            {errors.email && (
              <p className="text-xs text-danger">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-ink block">
                Password <span className="text-danger">*</span>
              </label>
              <Link to="/forgot-password" className="text-xs font-semibold text-accent-strong hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                placeholder="••••••••"
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

          <Button type="submit" isLoading={isLoading} className="w-full rounded-[8px] font-semibold text-sm h-11">
            Sign in
          </Button>
        </form>

        {/* Footer */}
        <div className="text-xs text-ink-muted pt-3 border-t border-border text-center">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-accent-strong hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
