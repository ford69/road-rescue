export type GeolocationFailureReason =
  | 'unsupported'
  | 'permission_denied'
  | 'unavailable'
  | 'timeout'
  | 'offline'
  | 'unknown';

export class GeolocationRequestError extends Error {
  reason: GeolocationFailureReason;

  constructor(reason: GeolocationFailureReason, message: string) {
    super(message);
    this.reason = reason;
    this.name = 'GeolocationRequestError';
  }
}

const MESSAGES: Record<GeolocationFailureReason, string> = {
  unsupported: 'Location is not supported in this browser.',
  permission_denied:
    'Location permission was denied. Enable location for Road Rescue in your browser or device settings.',
  unavailable: 'Your location is currently unavailable. Move to an open area and try again.',
  timeout: 'Location request timed out. Check GPS signal and try again.',
  offline: 'Location sharing requires an internet connection for live tracking updates.',
  unknown: 'Unable to read your location right now.',
};

export function geolocationErrorMessage(reason: GeolocationFailureReason): string {
  return MESSAGES[reason];
}

function mapPositionError(error: GeolocationPositionError): GeolocationRequestError {
  if (error.code === error.PERMISSION_DENIED) {
    return new GeolocationRequestError('permission_denied', MESSAGES.permission_denied);
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return new GeolocationRequestError('unavailable', MESSAGES.unavailable);
  }
  if (error.code === error.TIMEOUT) {
    return new GeolocationRequestError('timeout', MESSAGES.timeout);
  }
  return new GeolocationRequestError('unknown', MESSAGES.unknown);
}

export function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    return Promise.reject(new GeolocationRequestError('unsupported', MESSAGES.unsupported));
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    // GPS can still work offline, but Road Rescue live sharing needs network.
    // We still allow the read; callers decide whether to upload.
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(mapPositionError(error)),
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 5_000,
        ...options,
      },
    );
  });
}

export function watchPosition(
  onSuccess: (position: GeolocationPosition) => void,
  onError: (error: GeolocationRequestError) => void,
  options?: PositionOptions,
): number | null {
  if (!navigator.geolocation) {
    onError(new GeolocationRequestError('unsupported', MESSAGES.unsupported));
    return null;
  }

  return navigator.geolocation.watchPosition(
    onSuccess,
    (error) => onError(mapPositionError(error)),
    {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 5_000,
      ...options,
    },
  );
}

export function clearWatch(watchId: number | null): void {
  if (watchId == null || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(watchId);
}
