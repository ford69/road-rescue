import * as React from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import { divIcon, latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  type: 'user' | 'mechanic' | 'destination';
  label?: string;
}

function markerIcon(type: MapMarker['type'], label?: string) {
  const color =
    type === 'mechanic' ? '#f4c430' : type === 'destination' ? '#16a34a' : '#18181b';
  const symbol = type === 'mechanic' ? '🔧' : type === 'destination' ? '➤' : '●';
  return divIcon({
    className: '',
    iconSize: [44, 54],
    iconAnchor: [22, 22],
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="width:40px;height:40px;border-radius:9999px;background:${color};color:white;display:flex;align-items:center;justify-content:center;border:4px solid rgba(255,255,255,.8);box-shadow:0 4px 14px rgba(0,0,0,.25);font-size:16px">${symbol}</div>
      ${label ? `<span style="white-space:nowrap;background:white;color:#18181b;border-radius:7px;padding:1px 6px;font:600 11px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.15)">${label}</span>` : ''}
    </div>`,
  });
}

const tileProviders = [
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    url: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
];

function ResilientTileLayer({ onAllProvidersFailed }: { onAllProvidersFailed: () => void }) {
  const [providerIndex, setProviderIndex] = React.useState(0);
  const provider = tileProviders[providerIndex];

  return (
    <TileLayer
      key={provider.url}
      url={provider.url}
      attribution={provider.attribution}
      eventHandlers={{
        tileerror: () => {
          if (providerIndex < tileProviders.length - 1) {
            setProviderIndex(providerIndex + 1);
            return;
          }
          onAllProvidersFailed();
        },
      }}
    />
  );
}

function FitMarkers({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (markers.length === 1) {
      map.setView([markers[0].latitude, markers[0].longitude], 15);
    } else if (markers.length > 1) {
      map.fitBounds(
        latLngBounds(markers.map((marker) => [marker.latitude, marker.longitude])),
        { padding: [48, 48], maxZoom: 15 },
      );
    }
  }, [map, markers]);
  return null;
}

/** Keeps Leaflet tiles sized correctly across rotate / resize / flex layouts. */
function InvalidateSizeOnResize() {
  const map = useMap();

  React.useEffect(() => {
    const container = map.getContainer();
    let frame = 0;

    const invalidate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
      });
    };

    invalidate();
    const timeouts = [50, 200, 500].map((ms) => window.setTimeout(invalidate, ms));

    const observer = new ResizeObserver(invalidate);
    observer.observe(container);

    window.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);
    document.addEventListener('visibilitychange', invalidate);

    return () => {
      cancelAnimationFrame(frame);
      timeouts.forEach((id) => window.clearTimeout(id));
      observer.disconnect();
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
      document.removeEventListener('visibilitychange', invalidate);
    };
  }, [map]);

  return null;
}

export function MapView({
  markers = [],
  showRoute = false,
  routePath,
  className,
  children,
  interactive = true,
}: {
  markers?: MapMarker[];
  showRoute?: boolean;
  routePath?: { latitude: number; longitude: number }[];
  className?: string;
  children?: React.ReactNode;
  interactive?: boolean;
}) {
  const [tilesUnavailable, setTilesUnavailable] = React.useState(false);

  return (
    <div className={cn('relative isolate min-h-[12rem] overflow-hidden bg-muted', className)}>
      <MapContainer
        center={[5.6037, -0.187]}
        zoom={12}
        className="absolute inset-0 z-0 h-full w-full"
        style={{ minHeight: '100%', height: '100%', width: '100%' }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
      >
        <ResilientTileLayer onAllProvidersFailed={() => setTilesUnavailable(true)} />
        <InvalidateSizeOnResize />
        <FitMarkers markers={markers} />
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.latitude, marker.longitude]}
            icon={markerIcon(marker.type, marker.label)}
          />
        ))}
        {showRoute && routePath && routePath.length > 1 && (
          <Polyline
            positions={routePath.map((point) => [point.latitude, point.longitude])}
            pathOptions={{ color: '#eab308', weight: 5, opacity: 0.9 }}
          />
        )}
      </MapContainer>

      {tilesUnavailable && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[550] -translate-x-1/2 rounded-full bg-card/95 px-3 py-1 text-xs font-medium text-muted-foreground shadow-elevated">
          Map imagery offline · live positions still updating
        </div>
      )}

      {children && (
        <div className="pointer-events-none absolute inset-0 z-[500]">{children}</div>
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
