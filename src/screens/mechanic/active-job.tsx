import * as React from 'react';
import {
  Navigation2,
  Phone,
  MapPin,
  CheckCircle2,
  Wrench,
  ChevronUp,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { MapView, MapFloatingCard } from '@/components/map-view';
import { Timeline } from '@/components/timeline';
import { formatGhs } from '@/lib/currency';
import { serviceTypeConfig } from '@/lib/service-config';
import { useRequests } from '@/hooks/useApi';
import { mechanicsApi, requestsApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';
import type { RequestStatus, RescueRequestDto } from '@/api/types';
import { nextJobAction, canCancelJob } from '@/lib/job-status';
import { RequestChat } from '@/components/request-chat';
import { setActiveRescueFlag } from '@/pwa/active-rescue';
import {
  clearWatch,
  geolocationErrorMessage,
  watchPosition,
  type GeolocationRequestError,
} from '@/lib/geolocation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const ACTIVE = new Set(['accepted', 'enroute', 'arrived', 'inprogress']);

function customerName(job: RescueRequestDto): string {
  const user = job.customer?.userId;
  if (!user) return 'Customer';
  return `${user.firstName} ${user.lastName}`;
}

function vehicleLabel(job: RescueRequestDto): string {
  if (!job.vehicle) return 'Vehicle details pending';
  return `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.vehicleModel} · ${job.vehicle.registrationNumber}`;
}

export function MechanicActiveJob({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const { isOffline } = useNetworkStatus();
  const { data: requests, loading, reload } = useRequests({ pollMs: 8000 });
  const [sheetExpanded, setSheetExpanded] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [currentLocation, setCurrentLocation] = React.useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const lastSentAt = React.useRef(0);

  const active =
    requests.find((r) => ACTIVE.has(r.status)) ??
    requests.find((r) => r.status === 'completed') ??
    null;
  const activeId = active?._id;
  const activeStatus = active?.status;

  React.useEffect(() => {
    setActiveRescueFlag(Boolean(activeId && activeStatus && ACTIVE.has(activeStatus)));
    return () => setActiveRescueFlag(false);
  }, [activeId, activeStatus]);

  React.useEffect(() => {
    if (!activeId || !activeStatus || !ACTIVE.has(activeStatus)) return;

    const watchId = watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentLocation(next);
        if (isOffline) return;
        const now = Date.now();
        if (now - lastSentAt.current < 5000) return;
        lastSentAt.current = now;
        void mechanicsApi
          .updateLocation({
            ...next,
            heading: position.coords.heading ?? undefined,
            speed: position.coords.speed ?? undefined,
            requestId: activeId,
          })
          .catch(() => undefined);
      },
      (error: GeolocationRequestError) => {
        toast({
          type: 'error',
          title: 'Location unavailable',
          description: geolocationErrorMessage(error.reason),
        });
      },
    );

    return () => clearWatch(watchId);
  }, [activeId, activeStatus, isOffline, toast]);

  const advance = async (status: RequestStatus) => {
    if (!active) return;
    setBusy(true);
    try {
      await requestsApi.updateStatus(active._id, status);
      await reload();
      const action = nextJobAction(active.status);
      toast({
        type: 'success',
        title: action?.successTitle ?? 'Status updated',
        description: action?.successDescription,
      });
      if (status === 'completed') {
        onBack();
      }
    } catch (err) {
      toast({
        type: 'error',
        title: 'Update failed',
        description: err instanceof ApiClientError ? err.message : 'Could not update job status',
      });
    } finally {
      setBusy(false);
    }
  };

  const cancelJob = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await requestsApi.updateStatus(active._id, 'cancelled');
      await reload();
      toast({
        type: 'success',
        title: 'Job cancelled',
        description: 'The customer has been notified.',
      });
      onBack();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Cancel failed',
        description: err instanceof ApiClientError ? err.message : 'Could not cancel job',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading active job…</p>
      </div>
    );
  }

  if (!active || active.status === 'completed') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">
          {active?.status === 'completed' ? 'Job completed.' : 'No active job to navigate.'}
        </p>
        <Button onClick={onBack}>Back to jobs</Button>
      </div>
    );
  }

  const serviceLabel = serviceTypeConfig[active.serviceType]?.label ?? active.serviceType;
  const name = customerName(active);
  const phone = active.customer?.userId?.phone;
  const next = nextJobAction(active.status);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${active.pickupLocation.latitude},${active.pickupLocation.longitude}`;

  const timelineItems = [
    {
      title: 'Job accepted',
      status: 'done' as const,
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    {
      title: 'En route to customer',
      status:
        active.status === 'enroute'
          ? ('current' as const)
          : ['arrived', 'inprogress', 'completed'].includes(active.status)
            ? ('done' as const)
            : ('pending' as const),
      icon: <Navigation2 className="h-5 w-5" />,
    },
    {
      title: 'Arrived on site',
      status:
        active.status === 'arrived'
          ? ('current' as const)
          : ['inprogress', 'completed'].includes(active.status)
            ? ('done' as const)
            : ('pending' as const),
      icon: <MapPin className="h-5 w-5" />,
    },
    {
      title: 'Service in progress',
      status: active.status === 'inprogress' ? ('current' as const) : ('pending' as const),
      icon: <Wrench className="h-5 w-5" />,
    },
    {
      title: 'Job completed',
      status: 'pending' as const,
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
  ];

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
        <MapView
          className="absolute inset-0 h-full w-full"
          showRoute={
            Boolean(currentLocation) &&
            (active.status === 'accepted' || active.status === 'enroute')
          }
          routePath={
            currentLocation &&
            (active.status === 'accepted' || active.status === 'enroute')
              ? [
                  currentLocation,
                  {
                    latitude: active.pickupLocation.latitude,
                    longitude: active.pickupLocation.longitude,
                  },
                ]
              : undefined
          }
          markers={[
            ...(currentLocation
              ? [{ id: 'mech', ...currentLocation, type: 'mechanic' as const, label: 'You' }]
              : []),
            {
              id: 'customer',
              latitude: active.pickupLocation.latitude,
              longitude: active.pickupLocation.longitude,
              type: 'user',
              label: name.split(' ')[0],
            },
          ]}
        >
          <MapFloatingCard className="top-4 left-4 right-4" position="top">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-2 py-1.5 shadow-elevated backdrop-blur-sm">
              <Button variant="ghost" size="sm" onClick={onBack}>
                Back
              </Button>
              <div className="text-center">
                <p className="font-semibold text-sm">{serviceLabel}</p>
                <p className="text-xs text-muted-foreground">{formatGhs(active.quotedPrice)}</p>
              </div>
              <StatusChip status={active.status} />
            </div>
          </MapFloatingCard>
        </MapView>
      </div>

      <div
        className={cn(
          'relative z-10 shrink-0 overflow-y-auto rounded-t-3xl border border-border bg-card shadow-elevated transition-all',
          'max-h-[55dvh] landscape:max-h-[42dvh]',
          sheetExpanded ? 'max-h-[70dvh] landscape:max-h-[50dvh]' : 'max-h-44',
        )}
      >
        <Card className="rounded-none border-0 shadow-none">
          <button
            type="button"
            className="flex w-full items-center justify-center pt-3 pb-1"
            onClick={() => setSheetExpanded((v) => !v)}
          >
            {sheetExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          <div className="space-y-4 px-4 pb-6">
            <div>
              <p className="font-display text-lg font-bold">{name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{vehicleLabel(active)}</p>
              <p className="mt-2 flex items-center gap-1.5 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {active.pickupLocation.address}, {active.pickupLocation.city}
                </span>
              </p>
            </div>

            {sheetExpanded && (
              <>
                  <Timeline items={timelineItems} />

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="md"
                      disabled={!phone}
                      onClick={() => {
                        if (phone) window.location.assign(`tel:${phone.replace(/[^\d+]/g, '')}`);
                      }}
                    >
                      <Phone className="h-4 w-4" />
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => setChatOpen(true)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Chat
                    </Button>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => window.open(mapsUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <Navigation2 className="h-4 w-4" />
                      Navigate
                    </Button>
                  </div>
                </>
              )}

              {next && (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void advance(next.status)}
                >
                  {busy ? 'Updating…' : next.label}
                </Button>
              )}

              {canCancelJob(active.status) && (
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full text-destructive"
                  disabled={busy}
                  onClick={() => void cancelJob()}
                >
                  Cancel job
                </Button>
              )}
            </div>
        </Card>
      </div>
      <RequestChat
        requestId={active._id}
        recipientName={name}
        open={chatOpen}
        onOpenChange={setChatOpen}
      />
    </div>
  );
}
