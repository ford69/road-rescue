import * as React from 'react';
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapMouseEvent,
  type MapRef,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { useDrivingRoute } from '@/hooks/useDrivingRoute';
import { ACCRA_CENTER, getMapboxToken, hasMapboxToken, mapboxStyle } from '@/lib/mapbox';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  type: 'user' | 'mechanic' | 'destination';
  label?: string;
}

const MARKER_STYLES: Record<MapMarker['type'], { background: string; symbol: string }> = {
  mechanic: { background: '#f4c430', symbol: '🔧' },
  destination: { background: '#16a34a', symbol: '➤' },
  user: { background: '#18181b', symbol: '●' },
};

export function MapView({
  markers = [],
  showRoute = false,
  routePath,
  className,
  children,
  interactive = true,
  cooperativeGestures = false,
  onMapClick,
  onRouteReady,
}: {
  markers?: MapMarker[];
  showRoute?: boolean;
  routePath?: { latitude: number; longitude: number }[];
  className?: string;
  children?: React.ReactNode;
  interactive?: boolean;
  cooperativeGestures?: boolean;
  onMapClick?: (point: { latitude: number; longitude: number }) => void;
  onRouteReady?: (summary: { durationSeconds: number; distanceMeters: number } | null) => void;
}) {
  const { theme } = useTheme();
  const mapRef = React.useRef<MapRef>(null);
  const token = getMapboxToken();
  const configured = hasMapboxToken();
  const [styleFailed, setStyleFailed] = React.useState(false);

  const safeMarkers = React.useMemo(
    () =>
      (markers ?? []).filter(
        (marker) => Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude),
      ),
    [markers],
  );

  const { path, etaLabel, summary } = useDrivingRoute(
    routePath,
    showRoute && Boolean(routePath?.length),
  );
  const onRouteReadyRef = React.useRef(onRouteReady);
  onRouteReadyRef.current = onRouteReady;

  React.useEffect(() => {
    onRouteReadyRef.current?.(summary);
  }, [summary]);

  const fitPoints = React.useMemo(() => {
    if (path?.length) return path;
    return safeMarkers.map((marker) => ({
      latitude: marker.latitude,
      longitude: marker.longitude,
    }));
  }, [path, safeMarkers]);

  const fitKey = fitPoints.map((point) => `${point.latitude},${point.longitude}`).join('|');

  const fitToPoints = React.useCallback(() => {
    const map = mapRef.current;
    if (!map || !fitPoints.length) return;
    if (fitPoints.length === 1) {
      map.easeTo({
        center: [fitPoints[0].longitude, fitPoints[0].latitude],
        zoom: 15,
        duration: 500,
      });
      return;
    }
    const lngs = fitPoints.map((point) => point.longitude);
    const lats = fitPoints.map((point) => point.latitude);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 56, maxZoom: 15, duration: 500 },
    );
  }, [fitPoints]);

  React.useEffect(() => {
    fitToPoints();
  }, [fitKey, fitToPoints]);

  React.useEffect(() => {
    const map = mapRef.current?.getMap();
    const container = map?.getContainer();
    if (!map || !container) return;

    const resize = () => map.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, [configured]);

  const routeGeoJson = React.useMemo(
    () =>
      path && path.length > 1
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'LineString' as const,
              coordinates: path.map((point) => [point.longitude, point.latitude]),
            },
          }
        : null,
    [path],
  );

  const handleClick = (event: MapMouseEvent) => {
    const target = event.originalEvent.target as HTMLElement | null;
    if (target?.closest('.rr-map-marker')) return;
    onMapClick?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
  };

  return (
    <div className={cn('rr-map relative isolate min-h-[12rem] overflow-hidden bg-muted', className)}>
      {configured ? (
        <Map
          ref={mapRef}
          mapboxAccessToken={token}
          reuseMaps
          initialViewState={{
            longitude: ACCRA_CENTER.longitude,
            latitude: ACCRA_CENTER.latitude,
            zoom: 12,
          }}
          mapStyle={mapboxStyle(theme)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          attributionControl
          dragRotate={false}
          pitchWithRotate={false}
          touchPitch={false}
          scrollZoom={interactive}
          dragPan={interactive}
          doubleClickZoom={interactive}
          keyboard={interactive}
          cooperativeGestures={cooperativeGestures}
          cursor={onMapClick ? 'pointer' : undefined}
          onClick={onMapClick ? handleClick : undefined}
          onLoad={fitToPoints}
          onError={() => setStyleFailed(true)}
        >
          {interactive ? <NavigationControl position="bottom-right" showCompass={false} /> : null}
          {routeGeoJson ? (
            <Source id="rescue-route" type="geojson" data={routeGeoJson}>
              <Layer
                id="rescue-route-casing"
                type="line"
                paint={{
                  'line-color': '#18181b',
                  'line-width': 8,
                  'line-opacity': 0.35,
                }}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
              <Layer
                id="rescue-route-line"
                type="line"
                paint={{
                  'line-color': '#eab308',
                  'line-width': 5,
                  'line-opacity': 0.95,
                }}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
            </Source>
          ) : null}
          {safeMarkers.map((marker) => {
            const style = MARKER_STYLES[marker.type];
            return (
              <Marker
                key={marker.id}
                latitude={marker.latitude}
                longitude={marker.longitude}
                anchor="center"
                style={{ zIndex: marker.type === 'mechanic' ? 2 : 1 }}
              >
                <div className="rr-map-marker flex flex-col items-center gap-1">
                  {marker.label ? (
                    <span className="whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-zinc-900 shadow-md">
                      {marker.label}
                    </span>
                  ) : null}
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border-4 border-white text-base text-white shadow-lg"
                    style={{ background: style.background }}
                  >
                    {style.symbol}
                  </div>
                </div>
              </Marker>
            );
          })}
        </Map>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted px-6 text-center">
          <p className="max-w-xs text-sm text-muted-foreground">
            Add <span className="font-semibold text-foreground">VITE_MAPBOX_ACCESS_TOKEN</span> to
            enable live maps.
          </p>
        </div>
      )}

      {styleFailed && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[20] -translate-x-1/2 rounded-full bg-card/95 px-3 py-1 text-xs font-medium text-muted-foreground shadow-elevated">
          Map imagery offline · live positions still updating
        </div>
      )}

      {etaLabel && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[20] rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-elevated">
          {etaLabel}
        </div>
      )}

      {children && (
        <div className="pointer-events-none absolute inset-0 z-[30]">{children}</div>
      )}
    </div>
  );
}

export function MapFloatingCard({
  children,
  className,
  position = 'bottom',
}: {
  children: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom';
}) {
  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-3 right-3',
        position === 'top' ? 'top-3' : 'bottom-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
