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

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  bio: z.string().max(250).optional(),
});

export function SignupPage() {
  const { register: registerAuth } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await registerAuth(data);
      toast.success('Account created! Welcome to IdeaPulse.');
      navigate('/feed');
    } catch (err) {
      toast.error(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-ink py-14 sm:py-20 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-7 sm:p-8 space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="w-10 h-10 rounded-[10px] bg-accent-strong text-accent-ink mx-auto flex items-center justify-center select-none mb-3">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Create an account
          </h1>
          <p className="text-xs text-ink-muted leading-relaxed">
            Join the community to rate ideas, post feedback, or share new concepts.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="signup-name" className="text-xs font-bold uppercase tracking-wider text-ink block">
              Full name <span className="text-danger">*</span>
            </label>
            <Input
              id="signup-name"
              type="text"
              autoFocus
              autoComplete="name"
              {...register('name')}
              placeholder="e.g. Maya Lin"
              hasError={!!errors.name}
              className="h-11"
            />
            {errors.name && (
              <p className="text-xs text-danger">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signup-email" className="text-xs font-bold uppercase tracking-wider text-ink block">
              Email <span className="text-danger">*</span>
            </label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              {...register('email')}
              placeholder="maya@example.com"
              hasError={!!errors.email}
              className="h-11"
            />
            {errors.email && (
              <p className="text-xs text-danger">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signup-password" className="text-xs font-bold uppercase tracking-wider text-ink block">
              Password <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                placeholder="At least 6 characters"
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
            <label htmlFor="signup-bio" className="text-xs font-bold uppercase tracking-wider text-ink block">
              Bio <span className="text-ink-faint font-normal lowercase">(optional)</span>
            </label>
            <Input
              id="signup-bio"
              type="text"
              {...register('bio')}
              placeholder="e.g. Design systems lead, indie builder"
              className="h-11 text-xs"
            />
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full rounded-[8px] font-semibold text-sm h-11">
            Create account
          </Button>
        </form>

        <div className="text-xs text-ink-muted pt-3 border-t border-border text-center">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent-strong hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
