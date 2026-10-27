import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
});

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSentTo(data.email);
    } catch (err) {
      toast.error(err.message || 'Could not send a reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-ink py-16 sm:py-24 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-7 sm:p-8 space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Reset your password
          </h1>
          <p className="text-xs text-ink-muted leading-relaxed">
            Enter the email you signed up with and we'll send you a link to choose a new password.
          </p>
        </div>

        {sentTo ? (
          <p role="status" className="text-sm text-ink bg-surface-muted border border-border rounded-[8px] px-3 py-3 leading-relaxed">
            If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. It expires in 1 hour.
            Check your spam folder if it doesn't arrive in a few minutes.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="text-xs font-bold uppercase tracking-wider text-ink block">
                Email <span className="text-danger">*</span>
              </label>
              <Input
                id="forgot-email"
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

            <Button type="submit" isLoading={isLoading} className="w-full rounded-[8px] font-semibold text-sm h-11">
              Send reset link
            </Button>
          </form>
        )}

        <div className="text-xs text-ink-muted pt-3 border-t border-border text-center">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-accent-strong hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
