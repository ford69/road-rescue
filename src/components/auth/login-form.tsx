import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';
import type { ApiUser } from '@/api/types';
import { rememberPendingEmail } from '@/lib/auth-gate';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({
  onSuccess,
  showRegisterLink = true,
}: {
  onSuccess?: (user: ApiUser) => void;
  showRegisterLink?: boolean;
}) {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const user = await login(values.email, values.password);
      toast({ type: 'success', title: 'Welcome back', description: `Signed in as ${user.firstName}` });
      onSuccess?.(user);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'EMAIL_NOT_VERIFIED') {
        rememberPendingEmail(values.email);
        navigate(`/auth/verify-email?email=${encodeURIComponent(values.email)}`, { replace: true });
        return;
      }
      toast({
        type: 'error',
        title: 'Login failed',
        description: error instanceof ApiClientError ? error.message : 'Unable to sign in',
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Field label="Email" error={form.formState.errors.email?.message}>
        <Input type="email" placeholder="ama.serwaa@example.com" {...form.register('email')} />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        <PasswordInput
          placeholder="••••••••"
          autoComplete="current-password"
          error={Boolean(form.formState.errors.password)}
          {...form.register('password')}
        />
      </Field>
      <div className="flex justify-end">
        <Link className="text-sm font-medium text-primary" to="/auth/forgot-password">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
      {showRegisterLink && (
        <p className="text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link className="font-semibold text-primary" to="/auth/register">
            Create an account
          </Link>
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="text-xs text-critical">{error}</span>}
    </label>
  );
}

const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof Input> & { error?: boolean }
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`pr-12 ${className ?? ''}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Eye className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';
