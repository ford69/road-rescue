import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { authApi } from '@/api/auth';
import { ApiClientError } from '@/api/client/http';
import { useAuth } from '@/context/auth-context';
import { clearPendingEmail, postAuthPath, readPendingEmail, rememberPendingEmail } from '@/lib/auth-gate';

type VerifyState = 'waiting' | 'verifying' | 'success' | 'invalid' | 'expired' | 'already';

const RESEND_COOLDOWN_MS = 60_000;

export function VerifyEmailScreen() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user, setUser, isAuthenticated, logout } = useAuth();
  const token = search.get('token') ?? '';
  const emailFromQuery = search.get('email') ?? '';
  const [email, setEmail] = React.useState(emailFromQuery || readPendingEmail() || user?.email || '');
  const [state, setState] = React.useState<VerifyState>(token ? 'verifying' : 'waiting');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [resendUntil, setResendUntil] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (email) rememberPendingEmail(email);
  }, [email]);

  React.useEffect(() => {
    if (user?.emailVerified) {
      setState('already');
    }
  }, [user?.emailVerified]);

  React.useEffect(() => {
    if (!token || user?.emailVerified) return;
    let cancelled = false;
    setState('verifying');
    void authApi
      .verifyEmail(token)
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        clearPendingEmail();
        setState('success');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const code = error instanceof ApiClientError ? error.code : undefined;
        if (code === 'EMAIL_ALREADY_VERIFIED') {
          setState('already');
          return;
        }
        if (code === 'VERIFICATION_TOKEN_EXPIRED') {
          setState('expired');
          return;
        }
        setErrorMessage(error instanceof ApiClientError ? error.message : 'Verification failed');
        setState('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [token, setUser, user?.emailVerified]);

  React.useEffect(() => {
    if (resendUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [resendUntil]);

  const remainingSeconds = Math.max(0, Math.ceil((resendUntil - now) / 1000));

  const resend = async () => {
    const target = email.trim();
    if (!target) {
      setErrorMessage('Enter the email address for this account.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      await authApi.resendVerification(target);
      rememberPendingEmail(target);
      setResendUntil(Date.now() + RESEND_COOLDOWN_MS);
      setState('waiting');
    } catch (error) {
      const code = error instanceof ApiClientError ? error.code : undefined;
      if (code === 'EMAIL_ALREADY_VERIFIED') {
        setState('already');
      } else if (code === 'VERIFICATION_EMAIL_RATE_LIMITED') {
        setResendUntil(Date.now() + RESEND_COOLDOWN_MS);
        setErrorMessage('Please wait before requesting another email.');
      } else if (error instanceof ApiClientError && error.status === 404) {
        setErrorMessage(
          'Could not reach the verification service. If you used this account before, try signing in again — existing accounts no longer need a new email.',
        );
      } else {
        setErrorMessage(error instanceof ApiClientError ? error.message : 'Unable to resend email');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const continueToApp = () => {
    if (user) {
      navigate(postAuthPath(user), { replace: true });
      return;
    }
    navigate('/auth/login', { replace: true });
  };

  const goToLogin = async () => {
    try {
      if (isAuthenticated) {
        await logout();
      }
    } catch {
      setUser(null);
    }
    navigate('/auth/login', { replace: true });
  };

  React.useEffect(() => {
    if (token) return;
    if (isAuthenticated && user?.role === 'customer' && !user.hasActiveSubscription && !user.emailVerified) {
      navigate('/auth/complete-subscription', { replace: true });
    }
  }, [isAuthenticated, navigate, token, user]);

  React.useEffect(() => {
    if (isAuthenticated && user?.emailVerified && state !== 'success' && state !== 'already') {
      navigate(postAuthPath(user), { replace: true });
    }
  }, [isAuthenticated, user, state, navigate]);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <Card className="p-6 space-y-4">
          {state === 'verifying' && (
            <>
              <h1 className="font-display text-2xl font-bold tracking-tight">Verifying your email…</h1>
              <p className="text-sm text-muted-foreground">Please wait while we confirm your Road Rescue account.</p>
            </>
          )}

          {state === 'waiting' && (
            <>
              <h1 className="font-display text-2xl font-bold tracking-tight">Verify your email</h1>
              <p className="text-sm text-muted-foreground">
                We&apos;ve sent a verification link to:
              </p>
              <p className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold">
                {email || 'your email address'}
              </p>
              <p className="text-sm text-muted-foreground">
                Please check your inbox and click the link to activate your Road Rescue account.
              </p>
              {!email && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Email</span>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
              )}
              <Button
                className="w-full"
                onClick={() => void resend()}
                disabled={submitting || remainingSeconds > 0}
              >
                {remainingSeconds > 0
                  ? `Resend available in ${remainingSeconds} seconds`
                  : submitting
                    ? 'Sending…'
                    : 'Resend verification email'}
              </Button>
            </>
          )}

          {state === 'success' && (
            <>
              <MailCheck className="h-10 w-10 text-success" />
              <h1 className="font-display text-2xl font-bold tracking-tight">Email verified!</h1>
              <p className="text-sm text-muted-foreground">
                Your Road Rescue account is now verified.
              </p>
              <Button className="w-full" onClick={continueToApp}>
                Continue to Road Rescue
              </Button>
            </>
          )}

          {state === 'already' && (
            <>
              <MailCheck className="h-10 w-10 text-success" />
              <h1 className="font-display text-2xl font-bold tracking-tight">Your email is already verified.</h1>
              <Button className="w-full" onClick={continueToApp}>
                Continue to Road Rescue
              </Button>
            </>
          )}

          {(state === 'invalid' || state === 'expired') && (
            <>
              <ShieldAlert className="h-10 w-10 text-critical" />
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {state === 'expired'
                  ? 'This verification link has expired.'
                  : 'This verification link is invalid or has expired.'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Request a new verification email to continue.
              </p>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Email</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <Button
                className="w-full"
                onClick={() => void resend()}
                disabled={submitting || remainingSeconds > 0}
              >
                {remainingSeconds > 0
                  ? `Resend available in ${remainingSeconds} seconds`
                  : submitting
                    ? 'Sending…'
                    : 'Send a new verification email'}
              </Button>
            </>
          )}

          {errorMessage && <p className="text-sm text-critical">{errorMessage}</p>}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              className="text-center text-sm font-semibold text-primary"
              onClick={() => void goToLogin()}
            >
              Back to login
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
