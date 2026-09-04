import * as React from 'react';
import {
  MapPin,
  ShieldAlert,
  Truck,
  BatteryCharging,
  CircleDot,
  KeyRound,
  Fuel,
  AlertTriangle,
  Wrench,
  Star,
  Navigation2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/empty-state';
import { formatGhs } from '@/lib/currency';
import { serviceTypeConfig, mechanicDisplayName, mechanicInitials } from '@/lib/service-config';
import { DEFAULT_PICKUP_LOCATION } from '@/lib/locations';
import { useNearbyMechanics, useRequests, useServiceTypes, useSubscription } from '@/hooks/useApi';
import type { RescueRequestDto, ServiceType } from '@/api/types';
import { useToast } from '@/components/ui/toast';
import { ensureArray } from '@/lib/ensure-array';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Truck,
  BatteryCharging,
  CircleDot,
  KeyRound,
  Fuel,
  AlertTriangle,
  Wrench,
};

const ACTIVE_STATUSES = new Set(['requested', 'searching', 'assigned', 'accepted', 'enroute', 'arrived', 'inprogress', 'awaiting_confirmation', 'issue_reported']);

export function CustomerHome({
  onRequestHelp,
  onSelectRequest,
  onTrackRequest,
  onOpenMechanic,
}: {
  onRequestHelp: (service?: ServiceType) => void;
  onSelectRequest: (req: RescueRequestDto) => void;
  onTrackRequest: (req: RescueRequestDto) => void;
  onOpenMechanic: (mechanicId: string) => void;
}) {
  const { data: requestList, loading: requestsLoading, error: requestsError } = useRequests();
  const { data: mechanicList, loading: mechanicsLoading } = useNearbyMechanics(
    DEFAULT_PICKUP_LOCATION.latitude,
    DEFAULT_PICKUP_LOCATION.longitude,
  );
  const { data: serviceTypeList } = useServiceTypes();
  const { data: membership } = useSubscription();
  const { toast } = useToast();
  const requests = ensureArray(requestList);
  const mechanics = ensureArray(mechanicList);
  const serviceTypes = ensureArray(serviceTypeList);
  const restricted = new Set(membership?.restrictedServiceTypes ?? ['towing', 'fuel', 'accident']);

  const requestService = (type?: ServiceType) => {
    if (type && restricted.has(type)) {
      toast({
        type: 'info',
        title: `${serviceTypeConfig[type].label} is not included in your Basic plan.`,
        description: 'Upgrade to Premium to access this service. Premium is coming soon.',
      });
      return;
    }
    onRequestHelp(type);
  };

  const latestRequest = requests[0];
  const activeRequest =
    latestRequest && ACTIVE_STATUSES.has(latestRequest.status) ? latestRequest : undefined;
  const recent = requests.slice(0, 5);
  const quickServices = (serviceTypes.length
    ? serviceTypes.map((s) => s.slug)
    : (['towing', 'flat-tire', 'battery', 'lockout', 'fuel', 'accident', 'other'] as ServiceType[])
  );

  const primaryServices = quickServices.slice(0, 4);
  const secondaryServices = quickServices.slice(4);

  return (
    <div className="space-y-6 pb-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-foreground to-foreground/80 text-background dark:from-zinc-800 dark:to-zinc-900">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-background/60 dark:text-zinc-400">
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-medium">Current Location</span>
            </div>
            <Badge className="bg-primary/20 text-primary border-0">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
              Live
            </Badge>
          </div>
          <p className="font-display text-xl font-bold mt-2">{DEFAULT_PICKUP_LOCATION.address}</p>
          <p className="text-sm text-background/60 dark:text-zinc-400 mt-0.5">
            {DEFAULT_PICKUP_LOCATION.city}, Ghana
          </p>
        </div>
      </Card>

      <div className="space-y-3">
        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => requestService()}
          className="relative overflow-hidden shadow-yellow-glow"
        >
          <ShieldAlert className="h-6 w-6" />
          Request Assistance
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Average response time: <span className="font-bold text-foreground">7 min</span>
        </p>
      </div>

      <div>
        <h2 className="font-display text-base font-bold mb-3 px-1">Quick Services</h2>
        <div className="grid grid-cols-4 gap-2">
          {primaryServices.map((type) => {
            const config = serviceTypeConfig[type];
            if (!config) return null;
            const Icon = iconMap[config.icon] ?? Wrench;
            return (
              <button
                key={type}
                onClick={() => requestService(type)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 transition-all hover:shadow-card hover:border-primary-200 active:scale-95"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-foreground">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-semibold text-center leading-tight">{config.label}</span>
                {restricted.has(type) && (
                  <span className="text-[10px] font-semibold text-muted-foreground">Premium</span>
                )}
              </button>
            );
          })}
        </div>
        {secondaryServices.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {secondaryServices.map((type) => {
              const config = serviceTypeConfig[type];
              if (!config) return null;
              const Icon = iconMap[config.icon] ?? Wrench;
              return (
                <button
                  key={type}
                  onClick={() => requestService(type)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 transition-all hover:shadow-card hover:border-primary-200 active:scale-95"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold leading-tight">{config.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activeRequest && (
        <Card interactive onClick={() => onTrackRequest(activeRequest)} className="border-border bg-accent/50">
          <div className="p-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background dark:bg-zinc-800 dark:text-primary">
                <Navigation2 className="h-6 w-6" />
              </div>
              <span className="absolute -inset-1 rounded-full border-2 border-primary animate-pulse-ring" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">Active rescue</p>
                <StatusChip status={activeRequest.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {activeRequest.status === 'awaiting_confirmation'
                  ? 'Your mechanic requested confirmation. Review the service and confirm or report an issue.'
                  : activeRequest.status === 'issue_reported'
                    ? 'Your issue report is open. This service stays active until it is resolved.'
                    : activeRequest.mechanic
                      ? `${mechanicDisplayName(activeRequest.mechanic)} · ${activeRequest.pickupLocation.address}`
                      : `Matching mechanic near ${activeRequest.pickupLocation.address}`}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="font-display text-base font-bold">Nearby Mechanics</h2>
        </div>
        {mechanicsLoading ? (
          <p className="text-sm text-muted-foreground px-1">Loading mechanics…</p>
        ) : mechanics.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-10 w-10" />}
            title="No nearby mechanics"
            description="Available mechanics in Accra will appear here."
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {mechanics
              .filter((m) => m.availability)
              .slice(0, 6)
              .map((m) => {
                const name = mechanicDisplayName(m);
                return (
                  <Card key={m._id} interactive className="min-w-[240px] shrink-0" onClick={() => onOpenMechanic(m._id)}>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar fallback={mechanicInitials(name)} size="lg" ring />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            <span className="text-xs font-bold">{(m.rating ?? 0).toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">({m.reviewCount})</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{m.location?.city ?? 'Ghana'}</span>
                        <span>·</span>
                        <Clock className="h-3.5 w-3.5" />
                        <span>{m.completedJobs} jobs</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ensureArray(m.specialties).slice(0, 3).map((s) => (
                          <Badge key={s} variant="subtle">
                            {serviceTypeConfig[s]?.label ?? s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-base font-bold mb-3 px-1">Recent Requests</h2>
        {requestsLoading ? (
          <p className="text-sm text-muted-foreground px-1">Loading requests…</p>
        ) : requestsError ? (
          <EmptyState icon={<Wrench className="h-10 w-10" />} title="Could not load requests" description={requestsError} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-10 w-10" />}
            title="No requests yet"
            description="Request roadside assistance to get started."
            action={
              <Button variant="primary" onClick={() => requestService()}>
                Request Assistance
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {recent.map((req) => {
              const config = serviceTypeConfig[req.serviceType];
              const Icon = iconMap[config?.icon ?? 'Wrench'] ?? Wrench;
              return (
                <Card key={req._id} interactive onClick={() => onSelectRequest(req)}>
                  <div className="p-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{config?.label ?? req.serviceType}</p>
                        <StatusChip status={req.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {req.pickupLocation?.address}, {req.pickupLocation?.city}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{formatGhs(req.quotedPrice)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString('en-GH', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
