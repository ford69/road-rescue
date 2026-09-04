import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminApi,
  mechanicsApi,
  notificationsApi,
  requestsApi,
  vehiclesApi,
  catalogApi,
  subscriptionsApi,
} from '@/api/repositories';
import type {
  MechanicDto,
  NotificationDto,
  RescueRequestDto,
  ServiceTypeDto,
  SubscriptionSummaryDto,
  VehicleDto,
} from '@/api/types';
import { ensureArray } from '@/lib/ensure-array';

export function useVehicles(enabled = true) {
  const [data, setData] = useState<VehicleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(ensureArray(await vehiclesApi.list()));
    } catch (err) {
      // Non-customer roles are not allowed to list vehicles.
      setData([]);
      setError(err instanceof Error ? err.message : 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void reload();
  }, [enabled, reload]);

  return { data, loading, error, reload };
}

export function useRequests(options?: { pollMs?: number }) {
  const [data, setData] = useState<RescueRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const reload = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setError(null);
    try {
        setData(ensureArray(await requestsApi.list()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!options?.pollMs) return;
    const poll = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    const timer = window.setInterval(poll, options.pollMs);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [options?.pollMs, reload]);

  return { data, loading, error, reload };
}

export function useNotifications() {
  const [data, setData] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(ensureArray(await notificationsApi.list()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, markAllRead: notificationsApi.markAllRead };
}

export function useNearbyMechanics(lat = 5.6037, lng = -0.187) {
  const [data, setData] = useState<MechanicDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setData(ensureArray(await mechanicsApi.nearby(lat, lng)));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load mechanics');
      } finally {
        setLoading(false);
      }
    })();
  }, [lat, lng]);

  return { data, loading, error };
}

export function useServiceTypes() {
  const [data, setData] = useState<ServiceTypeDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setData(ensureArray(await catalogApi.serviceTypes()));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { data, loading };
}

export function useAdminDashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.dashboard>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setData(await adminApi.dashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function useAvailableJobs(options?: { pollMs?: number; enabled?: boolean }) {
  const [data, setData] = useState<RescueRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const reload = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setError(null);
    try {
      setData(ensureArray(await requestsApi.available()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options?.enabled === false) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void reload();
  }, [options?.enabled, reload]);

  useEffect(() => {
    if (!options?.pollMs || options.enabled === false) return;
    const poll = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    const timer = window.setInterval(poll, options.pollMs);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [options?.enabled, options?.pollMs, reload]);

  return { data, loading, error, reload, accept: requestsApi.accept };
}

export function useSubscription() {
  const [data, setData] = useState<SubscriptionSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void subscriptionsApi
      .current()
      .then((summary) => {
        if (!cancelled) setData(summary);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
