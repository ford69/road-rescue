import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Check, Eye, EyeOff, LifeBuoy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/context/auth-context';
import { authApi } from '@/api/auth';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';
import type { ApiUser } from '@/api/types';
import { postAuthPath, rememberPendingEmail } from '@/lib/auth-gate';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

const passwordRequirements = [
  { label: 'At least 8 characters', test: (password: string) => password.length >= 8 },
  { label: 'At least one uppercase letter (A–Z)', test: (password: string) => /[A-Z]/.test(password) },
  { label: 'At least one lowercase letter (a–z)', test: (password: string) => /[a-z]/.test(password) },
  { label: 'At least one number (0–9)', test: (password: string) => /[0-9]/.test(password) },
] as const;

function isValidPassword(password: string): boolean {
  return passwordRequirements.every((requirement) => requirement.test(password));
}

type LoginValues = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { user, isAuthenticated, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && isAuthenticated && user?.emailVerified) {
      navigate(postAuthPath(user, search.get('next')), { replace: true });
    }
  }, [isAuthenticated, loading, navigate, search, user]);

  const handleSuccess = (user: ApiUser) => {
    navigate(postAuthPath(user, search.get('next')), { replace: true });
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Road Rescue Ghana — 24/7 roadside assistance"
      footer={
        <p className="text-sm text-muted-foreground">
          New here?{' '}
          <Link className="font-semibold text-primary" to="/auth/register">
            Create an account
          </Link>
        </p>
      }
    >
      <LoginForm onSuccess={handleSuccess} showRegisterLink={false} />
    </AuthShell>
  );
}

export function AdminLoginScreen() {
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const user = await loginAdmin(values.email, values.password);
      toast({
        type: 'success',
        title: 'Admin access granted',
        description: `Welcome, ${user.firstName}`,
      });
      navigate(postAuthPath(user, '/admin/home'), { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'EMAIL_NOT_VERIFIED') {
        rememberPendingEmail(values.email);
        navigate(`/auth/verify-email?email=${encodeURIComponent(values.email)}`, { replace: true });
        return;
      }
      toast({
        type: 'error',
        title: 'Admin sign-in failed',
        description: error instanceof ApiClientError ? error.message : 'Unable to sign in',
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <AuthShell
      title="Admin sign in"
      subtitle="Restricted access for Road Rescue Ghana administrators"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Admin email" error={form.formState.errors.email?.message}>
          <Input type="email" placeholder="admin@roadrescue.gh" autoComplete="username" {...form.register('email')} />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message}>
          <PasswordInput
            placeholder="••••••••"
            autoComplete="current-password"
            error={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in as admin'}
        </Button>
      </form>
    </AuthShell>
  );
}

const registerSchema = z
  .object({
    role: z.enum(['customer', 'mechanic']),
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(9),
    password: passwordSchema,
    garageName: z.string().optional(),
    ghanaCardNumber: z.string().optional(),
    experience: z.coerce.number().min(0).max(50).optional(),
    truck: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === 'mechanic') {
      if (!value.garageName) ctx.addIssue({ code: 'custom', path: ['garageName'], message: 'Required' });
      if (!/^GHA-\d{9}-\d$/i.test(value.ghanaCardNumber ?? '')) {
        ctx.addIssue({
          code: 'custom',
          path: ['ghanaCardNumber'],
          message: 'Use format GHA-123456789-0',
        });
      }
      if (!value.city) ctx.addIssue({ code: 'custom', path: ['city'], message: 'Required' });
      if (!value.address) ctx.addIssue({ code: 'custom', path: ['address'], message: 'Required' });
    }
  });

type RegisterValues = z.infer<typeof registerSchema>;
const mechanicSpecialties = [
  'towing',
  'flat-tire',
  'battery',
  'lockout',
  'fuel',
  'accident',
  'other',
] as const;

export function RegisterScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [mechanicStep, setMechanicStep] = React.useState<1 | 2 | 3>(1);
  const [selfie, setSelfie] = React.useState<File | null>(null);
  const [specialties, setSpecialties] = React.useState<(typeof mechanicSpecialties)[number][]>([
    'battery',
    'flat-tire',
  ]);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'customer',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      garageName: '',
      ghanaCardNumber: '',
      experience: 1,
      truck: '',
      city: 'Accra',
      address: '',
    },
  });
  const role = form.watch('role');
  const password = form.watch('password');

  const advanceMechanicStep = async () => {
    const fields =
      mechanicStep === 1
        ? (['firstName', 'lastName', 'email', 'phone', 'password'] as const)
        : (['garageName', 'experience', 'city', 'address'] as const);
    const valid = await form.trigger(fields);
    if (!valid || (mechanicStep === 1 && !isValidPassword(password))) return;
    setMechanicStep((current) => (current === 1 ? 2 : 3));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.role === 'mechanic' && !selfie) {
      toast({
        type: 'error',
        title: 'Selfie required',
        description: 'Upload a clear photo of your face for identity verification.',
      });
      return;
    }
    if (values.role === 'mechanic' && specialties.length === 0) {
      toast({
        type: 'error',
        title: 'Select a specialty',
        description: 'Choose at least one roadside service.',
      });
      return;
    }
      setSubmitting(true);
    try {
      const result =
        values.role === 'customer'
          ? await authApi.registerCustomer({
              firstName: values.firstName,
              lastName: values.lastName,
              email: values.email,
              phone: values.phone,
              password: values.password,
            })
          : await authApi.registerMechanic({
              firstName: values.firstName,
              lastName: values.lastName,
              email: values.email,
              phone: values.phone,
              password: values.password,
              garageName: values.garageName || 'My Garage',
              ghanaCardNumber: values.ghanaCardNumber || '',
              selfie: selfie!,
              experience: values.experience ?? 0,
              city: values.city || 'Accra',
              address: values.address || 'Accra',
              latitude: 5.6037,
              longitude: -0.187,
              specialties,
              truck: values.truck || undefined,
            });
      rememberPendingEmail(result.email || values.email);
      toast({
        type: 'success',
        title: 'Account created',
        description: 'Please verify your email address before continuing.',
      });
      navigate(`/auth/verify-email?email=${encodeURIComponent(result.email || values.email)}`, {
        replace: true,
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Registration failed',
        description: error instanceof ApiClientError ? error.message : 'Unable to register',
      });
    } finally {
      setSubmitting(false);
    }
  });

  const handleRegistrationSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (role === 'mechanic' && mechanicStep < 3) {
      event.preventDefault();
      void advanceMechanicStep();
      return;
    }
    void onSubmit(event);
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Join Road Rescue Ghana as a customer or mechanic"
      footer={
        <p className="text-sm text-muted-foreground">
          Already registered?{' '}
          <Link className="font-semibold text-primary" to="/auth/login">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleRegistrationSubmit}>
        {role === 'mechanic' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Personal</span>
              <span>Business</span>
              <span>Verification</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 rounded-full ${
                    mechanicStep >= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Step {mechanicStep} of 3
            </p>
          </div>
        )}

        {mechanicStep === 1 && (
          <div className="grid grid-cols-2 gap-2">
          {(['customer', 'mechanic'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                form.setValue('role', option);
                setMechanicStep(1);
              }}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize ${
                role === option ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
              }`}
            >
              {option}
            </button>
          ))}
          </div>
        )}
        {(role === 'customer' || mechanicStep === 1) && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" error={form.formState.errors.firstName?.message}>
                <Input {...form.register('firstName')} />
              </Field>
              <Field label="Last name" error={form.formState.errors.lastName?.message}>
                <Input {...form.register('lastName')} />
              </Field>
            </div>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register('email')} />
            </Field>
            <Field label="Ghana phone" error={form.formState.errors.phone?.message}>
              <Input placeholder="0241234567" {...form.register('phone')} />
            </Field>
            <Field label="Password" error={form.formState.errors.password?.message}>
              <PasswordInput
                autoComplete="new-password"
                error={Boolean(form.formState.errors.password)}
                {...form.register('password')}
              />
            </Field>
            <PasswordRequirements password={password} />
          </>
        )}
        {role === 'mechanic' && mechanicStep === 2 && (
          <>
            <div>
              <h3 className="font-display text-lg font-bold">Business details</h3>
              <p className="text-sm text-muted-foreground">
                Tell us about your roadside assistance experience.
              </p>
            </div>
            <Field label="Garage name" error={form.formState.errors.garageName?.message}>
              <Input {...form.register('garageName')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Years of experience" error={form.formState.errors.experience?.message}>
                <Input type="number" min={0} max={50} {...form.register('experience')} />
              </Field>
              <Field label="Service vehicle" error={form.formState.errors.truck?.message}>
                <Input placeholder="Optional" {...form.register('truck')} />
              </Field>
            </div>
            <Field label="City" error={form.formState.errors.city?.message}>
              <Input placeholder="Accra" {...form.register('city')} />
            </Field>
            <Field label="Address" error={form.formState.errors.address?.message}>
              <Input placeholder="Spintex Road" {...form.register('address')} />
            </Field>
          </>
        )}
        {role === 'mechanic' && mechanicStep === 3 && (
          <>
            <div>
              <h3 className="font-display text-lg font-bold">Identity verification</h3>
              <p className="text-sm text-muted-foreground">
                These details are reviewed securely before you can accept jobs.
              </p>
            </div>
            <Field
              label="Ghana Card number"
              error={form.formState.errors.ghanaCardNumber?.message}
            >
              <Input
                placeholder="GHA-123456789-0"
                autoComplete="off"
                {...form.register('ghanaCardNumber', {
                  onChange: (event) => {
                    event.target.value = event.target.value.toUpperCase();
                  },
                })}
              />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium">Services offered</p>
              <div className="grid grid-cols-2 gap-2">
                {mechanicSpecialties.map((specialty) => {
                  const selected = specialties.includes(specialty);
                  return (
                    <button
                      key={specialty}
                      type="button"
                      onClick={() =>
                        setSpecialties((current) =>
                          selected
                            ? current.filter((item) => item !== specialty)
                            : [...current, specialty],
                        )
                      }
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-medium capitalize ${
                        selected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {specialty.replace('-', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Verification selfie</p>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-4 transition-colors hover:bg-accent">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {selfie?.name ?? 'Take or upload a clear selfie'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG or WebP · maximum 5MB
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  className="sr-only"
                  onChange={(event) => setSelfie(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </>
        )}
        {role === 'mechanic' ? (
          <div className="flex gap-2">
            {mechanicStep > 1 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={submitting}
                onClick={() =>
                  setMechanicStep((current) => (current === 3 ? 2 : 1))
                }
              >
                Back
              </Button>
            )}
            <Button
              type={mechanicStep === 3 ? 'submit' : 'button'}
              className="flex-[2]"
              disabled={submitting || (mechanicStep === 1 && !isValidPassword(password))}
              onClick={mechanicStep < 3 ? () => void advanceMechanicStep() : undefined}
            >
              {submitting
                ? 'Submitting…'
                : mechanicStep === 3
                  ? 'Submit application'
                  : 'Continue'}
            </Button>
          </div>
        ) : (
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !isValidPassword(password)}
          >
            {submitting ? 'Creating…' : 'Create account'}
          </Button>
        )}
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordScreen() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await authApi.forgotPassword(email);
      toast({
        type: 'success',
        title: 'Check your email',
        description: result.resetToken
          ? `Dev reset token: ${result.resetToken}`
          : result.message,
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Request failed',
        description: error instanceof ApiClientError ? error.message : 'Unable to send reset link',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Forgot password" subtitle="We will send a reset link if the account exists">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link className="block text-center text-sm font-semibold text-primary" to="/auth/login">
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordScreen() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = React.useState('');
  const [token, setToken] = React.useState(search.get('token') ?? '');
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidPassword(password)) {
      toast({
        type: 'error',
        title: 'Password requirements not met',
        description: 'Complete every password requirement before continuing.',
      });
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      toast({ type: 'success', title: 'Password updated', description: 'You can sign in now.' });
      navigate('/auth/login');
    } catch (error) {
      toast({
        type: 'error',
        title: 'Reset failed',
        description: error instanceof ApiClientError ? error.message : 'Unable to reset password',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Reset password" subtitle="Choose a new password for your account">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Reset token">
          <Input value={token} onChange={(e) => setToken(e.target.value)} required />
        </Field>
        <Field label="New password">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            error={password.length > 0 && !isValidPassword(password)}
          />
        </Field>
        <PasswordRequirements password={password} />
        <Button type="submit" className="w-full" disabled={submitting || !isValidPassword(password)}>
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-primary">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-xl font-bold leading-none">Road Rescue</p>
            <p className="text-xs text-muted-foreground">Ghana · ₵ Cedis</p>
          </div>
        </div>
        <Card className="p-6 space-y-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>
          {children}
        </Card>
        {footer}
      </div>
    </div>
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

function PasswordRequirements({ password }: { password: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3" aria-live="polite">
      <p className="mb-2 text-xs font-semibold text-foreground">Password requirements</p>
      <ul className="space-y-1.5">
        {passwordRequirements.map((requirement) => {
          const met = requirement.test(password);
          const Icon = met ? Check : X;
          return (
            <li
              key={requirement.label}
              className={`flex items-center gap-2 text-xs font-medium ${
                met ? 'text-success' : 'text-critical'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{requirement.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof Input>
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
