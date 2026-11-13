import * as React from 'react';
import {
  fetchDrivingRoute,
  formatRouteEta,
  type MapPoint,
  type MapboxRoute,
} from '@/lib/mapbox';

export function useDrivingRoute(points: MapPoint[] | undefined, enabled: boolean) {
  const [route, setRoute] = React.useState<MapboxRoute | null>(null);
  const origin = points?.[0];
  const destination = points && points.length > 1 ? points[points.length - 1] : undefined;
  const originKey = origin ? `${origin.latitude},${origin.longitude}` : '';
  const destinationKey = destination ? `${destination.latitude},${destination.longitude}` : '';

  React.useEffect(() => {
    if (!enabled || !origin || !destination) {
      setRoute(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchDrivingRoute(origin, destination, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setRoute(next);
        })
        .catch(() => {
          if (!controller.signal.aborted) setRoute(null);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [destination, destinationKey, enabled, origin, originKey]);

  const path = route?.coordinates?.length
    ? route.coordinates
    : enabled && points && points.length > 1
      ? points
      : undefined;

  return {
    path,
    etaLabel:
      route && route.durationSeconds > 0
        ? formatRouteEta(route.durationSeconds, route.distanceMeters)
        : null,
    summary: route
      ? { durationSeconds: route.durationSeconds, distanceMeters: route.distanceMeters }
      : null,
  };
}
