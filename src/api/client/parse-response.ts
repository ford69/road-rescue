export function statusFallbackMessage(status: number): string {
  if (status === 413) return 'Upload is too large. Use a smaller selfie photo.';
  return 'We could not complete this request. Please try again.';
}

export function userFacingAuthError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    if ('status' in error) return error.message;
    if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
      return 'Could not reach Road Rescue. Check your connection and try again.';
    }
  }
  return fallback;
}
