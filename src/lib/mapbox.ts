export const ACCRA_CENTER = { latitude: 5.6037, longitude: -0.187 };

export type MapPoint = { latitude: number; longitude: number };

export interface MapboxRoute {
  coordinates: MapPoint[];
  durationSeconds: number;
  distanceMeters: number;
}

export interface ReverseGeocodeResult {
  label: string;
  address: string;
  city: string;
}

export function getMapboxToken(): string {
  return (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '').trim();
}

export function hasMapboxToken(): boolean {
  return getMapboxToken().length > 0;
}

export function mapboxStyle(theme: 'light' | 'dark'): string {
  return theme === 'dark'
    ? 'mapbox://styles/mapbox/navigation-night-v1'
    : 'mapbox://styles/mapbox/navigation-day-v1';
}

export function formatRouteEta(durationSeconds: number, distanceMeters: number): string {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  const km = distanceMeters / 1000;
  const distance = km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
  return `${minutes} min · ${distance}`;
}

function roundCoord(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function routeCacheKey(origin: MapPoint, destination: MapPoint): string {
  return [
    roundCoord(origin.longitude),
    roundCoord(origin.latitude),
    roundCoord(destination.longitude),
    roundCoord(destination.latitude),
  ].join(',');
}

const routeCache = new Map<string, MapboxRoute>();

export async function fetchDrivingRoute(
  origin: MapPoint,
  destination: MapPoint,
  signal?: AbortSignal,
): Promise<MapboxRoute | null> {
  const token = getMapboxToken();
  if (!token) return null;

  const key = routeCacheKey(origin, destination);
  const cached = routeCache.get(key);
  if (cached) return cached;

  const path = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${path}`);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('alternatives', 'false');
  url.searchParams.set('access_token', token);

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    routes?: Array<{
      duration?: number;
      distance?: number;
      geometry?: { coordinates?: [number, number][] };
    }>;
  };
  const route = payload.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!route || !coordinates?.length) return null;

  const result: MapboxRoute = {
    coordinates: coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
    durationSeconds: route.duration ?? 0,
    distanceMeters: route.distance ?? 0,
  };
  routeCache.set(key, result);
  return result;
}

function contextText(
  context: Array<{ id?: string; text?: string }> | undefined,
  prefix: string,
): string | undefined {
  return context?.find((item) => item.id?.startsWith(prefix))?.text;
}

export async function reverseGeocode(
  point: MapPoint,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const token = getMapboxToken();
  const fallback: ReverseGeocodeResult = {
    label: 'Dropped pin',
    address: `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`,
    city: 'Ghana',
  };
  if (!token) return fallback;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.longitude},${point.latitude}.json`,
  );
  url.searchParams.set('types', 'address,poi,place,locality,neighborhood');
  url.searchParams.set('limit', '1');
  url.searchParams.set('country', 'gh');
  url.searchParams.set('access_token', token);

  const response = await fetch(url, { signal });
  if (!response.ok) return fallback;

  const payload = (await response.json()) as {
    features?: Array<{
      text?: string;
      place_name?: string;
      context?: Array<{ id?: string; text?: string }>;
    }>;
  };
  const feature = payload.features?.[0];
  if (!feature) return fallback;

  const city =
    contextText(feature.context, 'place.') ??
    contextText(feature.context, 'locality.') ??
    contextText(feature.context, 'district.') ??
    'Ghana';
  const address = feature.place_name?.split(',')[0]?.trim() || feature.text || fallback.address;

  return {
    label: feature.text || 'Dropped pin',
    address,
    city,
  };
}
