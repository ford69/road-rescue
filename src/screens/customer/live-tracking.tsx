import * as React from 'react';
import {
  Navigation2,
  Phone,
  MessageSquare,
  Star,
  Share2,
  Check,
  MapPin,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { StatusChip } from '@/components/ui/status-chip';
import { MapView, MapFloatingCard } from '@/components/map-view';
import { Timeline } from '@/components/timeline';
import { formatGhs } from '@/lib/currency';
import { mechanicDisplayName, mechanicInitials, serviceTypeConfig } from '@/lib/service-config';
import { useRequests } from '@/hooks/useApi';
import { paymentsApi, requestsApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';
import type { RequestStatus } from '@/api/types';
import { useRequestSocket } from '@/hooks/useRequestSocket';
import { RequestChat } from '@/components/request-chat';
import { setActiveRescueFlag } from '@/pwa/active-rescue';

type TrackPhase = 'waiting' | 'enroute' | 'arrived' | 'inprogress' | 'completed';

function toPhase(status: RequestStatus): TrackPhase {
  if (status === 'requested' || status === 'searching' || status === 'assigned') return 'waiting';
  if (status === 'arrived') return 'arrived';
  if (status === 'inprogress') return 'inprogress';
  if (status === 'completed') return 'completed';
  return 'enroute';
}

export function LiveTracking({
  onBack,
  onViewHistory,
}: {
  onBack: () => void;
  onViewHistory?: () => void;
}) {
  const { toast } = useToast();
  const { data: requests, loading, reload } = useRequests({ pollMs: 8000 });
  const [sheetExpanded, setSheetExpanded] = React.useState(true);
  const [cancelling, setCancelling] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [liveStatus, setLiveStatus] = React.useState<RequestStatus | null>(null);
  const [openingPayment, setOpeningPayment] = React.useState(false);

  // Requests are returned newest-first. Never fall back to an older active
  // request after the latest job completes.
  const latestRequest = requests[0] ?? null;
  const active =
    latestRequest &&
    [
      'requested',
      'searching',
      'assigned',
      'accepted',
      'enroute',
      'arrived',
      'inprogress',
      'completed',
    ].includes(latestRequest.status)
      ? latestRequest
      : null;
  const {
    location: liveLocation,
    connected,
    setLocation: setLiveLocation,
  } = useRequestSocket(active?._id, (status) => {
    setLiveStatus(status);
    void reload();
  });

  React.useEffect(() => {
    setLiveStatus(null);
  }, [active?._id]);

  React.useEffect(() => {
    const inFlight =
      Boolean(active) &&
      ['requested', 'searching', 'assigned', 'accepted', 'enroute', 'arrived', 'inprogress'].includes(
        active!.status,
      );
    setActiveRescueFlag(inFlight);
    return () => setActiveRescueFlag(false);
  }, [active, active?.status]);

  React.useEffect(() => {
    if (!active?._id) return;
    void requestsApi.location(active._id).then((location) => {
      if (!location) return;
      setLiveLocation({
        requestId: active._id,
        mechanicId: String(location.mechanic),
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading,
        speed: location.speed,
        recordedAt: location.recordedAt,
      });
    });
  }, [active?._id, setLiveLocation]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading live tracking…</p>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">No active rescue to track.</p>
        <Button onClick={onBack}>Back home</Button>
      </div>
    );
  }

  const displayStatus = liveStatus ?? active.status;
  const phase = toPhase(displayStatus);
  const mechanic = active.mechanic;
  const name = mechanic ? mechanicDisplayName(mechanic) : 'Waiting for mechanic';
  const phone = mechanic?.userId?.phone;
  const serviceLabel = serviceTypeConfig[active.serviceType]?.label ?? active.serviceType;
  const canCancel = displayStatus === 'requested';

  const timelineItems = [
    {
      title: 'Request received',
      time: new Date(active.createdAt).toLocaleTimeString('en-GH', {
        hour: 'numeric',
        minute: '2-digit',
      }),
      status: 'done' as const,
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    {
      title: mechanic ? 'Mechanic assigned' : 'Waiting for mechanic',
      time: mechanic ? 'Just now' : 'Live',
      status: mechanic ? ('done' as const) : ('current' as const),
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    {
      title: mechanic ? `${name.split(' ')[0]} is on the way` : 'Mechanic en route',
      time: phase === 'enroute' ? 'Now' : undefined,
      status:
        phase === 'enroute'
          ? ('current' as const)
          : phase === 'arrived' || phase === 'inprogress' || phase === 'completed'
            ? ('done' as const)
            : ('pending' as const),
      icon: <Navigation2 className="h-5 w-5" />,
    },
    {
      title: 'Mechanic arrived',
      status:
        phase === 'arrived'
          ? ('current' as const)
          : phase === 'inprogress' || phase === 'completed'
            ? ('done' as const)
            : ('pending' as const),
      icon: <MapPin className="h-5 w-5" />,
    },
    {
      title: 'Service in progress',
      status:
        phase === 'inprogress'
          ? ('current' as const)
          : phase === 'completed'
            ? ('done' as const)
            : ('pending' as const),
      icon: <Wrench className="h-5 w-5" />,
    },
    {
      title: 'Service completed',
      status: phase === 'completed' ? ('current' as const) : ('pending' as const),
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
  ];

  const cancelRequest = async () => {
    setCancelling(true);
    try {
      await requestsApi.updateStatus(active._id, 'cancelled');
      await reload();
      toast({
        type: 'success',
        title: 'Request cancelled',
        description: 'Your rescue request has been cancelled.',
      });
      onBack();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Cancel failed',
        description: err instanceof ApiClientError ? err.message : 'Could not cancel request',
      });
    } finally {
      setCancelling(false);
    }
  };

  const callMechanic = () => {
    if (!phone) {
      toast({
        type: 'error',
        title: 'Phone unavailable',
        description: 'The mechanic has not provided a contact number.',
      });
      return;
    }
    window.location.assign(`tel:${phone.replace(/[^\d+]/g, '')}`);
  };

  const shareTracking = async () => {
    const text = `${serviceLabel}: ${name} is handling the rescue at ${active.pickupLocation.address}, ${active.pickupLocation.city}. Current status: ${phase}.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Road Rescue Ghana', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ type: 'success', title: 'Tracking details copied' });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast({ type: 'error', title: 'Could not share tracking details' });
    }
  };

  const payForService = async () => {
    setOpeningPayment(true);
    try {
      const payment = await paymentsApi.initialize(active._id);
      window.location.assign(payment.authorizationUrl);
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not start payment',
        description: error instanceof Error ? error.message : 'Try again',
      });
      setOpeningPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 lg:absolute lg:inset-0 lg:z-0 bg-background">
      <MapView
        className="h-full w-full"
        showRoute={phase === 'enroute' && Boolean(liveLocation)}
        routePath={
          phase === 'enroute' && liveLocation
            ? [
                {
                  latitude: liveLocation.latitude,
                  longitude: liveLocation.longitude,
                },
                {
                  latitude: active.pickupLocation.latitude,
                  longitude: active.pickupLocation.longitude,
                },
              ]
            : undefined
        }
        markers={[
          {
            id: 'user',
            latitude: active.pickupLocation.latitude,
            longitude: active.pickupLocation.longitude,
            type: 'user',
            label: 'Pickup',
          },
          ...(liveLocation
            ? [
                {
                  id: 'mech',
                  latitude: liveLocation.latitude,
                  longitude: liveLocation.longitude,
                  type: 'mechanic' as const,
                  label: name.split(' ')[0],
                },
              ]
            : mechanic
              ? [
                  {
                    id: 'mech',
                    latitude: mechanic.latitude,
                    longitude: mechanic.longitude,
                    type: 'mechanic' as const,
                    label: name.split(' ')[0],
                  },
                ]
            : []),
        ]}
      >
        <MapFloatingCard className="top-4 left-4 right-4">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              Back
            </Button>
            <div className="text-center">
              <p className="font-semibold text-sm">{serviceLabel}</p>
              <p className="text-xs text-muted-foreground">
                {active.pickupLocation.address}, {active.pickupLocation.city} ·{' '}
                {connected ? 'Live' : 'Connecting…'}
              </p>
            </div>
            <StatusChip status={displayStatus} />
          </div>
        </MapFloatingCard>
      </MapView>

      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 z-[600] rounded-t-3xl border border-border bg-card shadow-elevated transition-all',
          sheetExpanded ? 'max-h-[75vh] overflow-y-auto' : 'h-auto',
        )}
      >
        <button
          className="mx-auto mt-2 block h-1.5 w-12 rounded-full bg-muted"
          onClick={() => setSheetExpanded((p) => !p)}
          aria-label="Toggle details"
        />
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {phase === 'waiting' ? 'Status' : phase === 'enroute' ? 'Next update' : 'Status'}
              </p>
              <p className="font-display text-2xl font-bold capitalize">
                {phase === 'waiting' ? 'Waiting for mechanic' : phase}
              </p>
            </div>
            <button onClick={() => setSheetExpanded((p) => !p)} className="rounded-xl p-2 hover:bg-accent">
              {sheetExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </button>
          </div>

          <Card>
            <div className="p-4 flex items-center gap-3">
              <Avatar fallback={mechanic ? mechanicInitials(name) : 'RR'} size="lg" ring />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{name}</p>
                {mechanic ? (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    {mechanic.rating.toFixed(1)} ({mechanic.reviewCount})
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nearby mechanics can accept this job</p>
                )}
              </div>
              {mechanic && (
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={callMechanic}
                    aria-label={`Call ${name}`}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setChatOpen(true)}
                    aria-label={`Chat with ${name}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => void shareTracking()}
                    aria-label="Share tracking details"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {sheetExpanded && (
            <>
              <Timeline items={timelineItems} />
              <div className="rounded-xl bg-accent p-4 flex items-center justify-between">
                <span className="text-sm font-medium">Quoted price</span>
                <span className="font-display text-xl font-bold">{formatGhs(active.quotedPrice)}</span>
              </div>
              {canCancel && (
                <Button
                  fullWidth
                  variant="outline"
                  disabled={cancelling}
                  onClick={() => void cancelRequest()}
                >
                  {cancelling ? 'Cancelling…' : 'Cancel request'}
                </Button>
              )}
              {phase === 'completed' && (
                <div className="space-y-2">
                  {active.paymentStatus !== 'paid' && (
                    <Button
                      fullWidth
                      size="lg"
                      disabled={openingPayment}
                      onClick={() => void payForService()}
                    >
                      <Check className="h-5 w-5" />
                      {openingPayment
                        ? 'Opening payment…'
                        : `Pay ${formatGhs(active.quotedPrice)}`}
                    </Button>
                  )}
                  <Button
                    fullWidth
                    variant="outline"
                    onClick={onViewHistory ?? onBack}
                  >
                    View service history
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
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
