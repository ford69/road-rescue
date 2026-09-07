export function isPublicAuthPath(path: string): boolean {
  return (
    path === '/auth/login' ||
    path === '/auth/login/admin' ||
    path === '/auth/admin/login' ||
    path.startsWith('/auth/register/') ||
    path === '/auth/forgot-password' ||
    path === '/auth/reset-password' ||
    path === '/auth/verify-email' ||
    path === '/auth/resend-verification' ||
    path === '/auth/verification/resend'
  );
}

export function shouldRestoreSessionOnPath(pathname: string): boolean {
  return !(
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/auth/register') ||
    pathname.startsWith('/auth/forgot-password') ||
    pathname.startsWith('/auth/reset-password') ||
    pathname.startsWith('/auth/admin')
  );
}

export function shouldAttemptRefresh(input: {
  status: number;
  retry: boolean;
  path: string;
  requestGeneration: number;
  currentGeneration: number;
  hasRefreshToken: boolean;
}): boolean {
  if (input.status !== 401 || !input.retry) return false;
  if (isPublicAuthPath(input.path)) return false;
  if (input.path === '/auth/logout' || input.path === '/auth/refresh') return false;
  if (input.requestGeneration !== input.currentGeneration) return false;
  return input.hasRefreshToken;
}
