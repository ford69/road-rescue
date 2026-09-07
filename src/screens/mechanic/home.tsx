import * as React from 'react';
import {
  Truck,
  BatteryCharging,
  CircleDot,
  KeyRound,
  Fuel,
  AlertTriangle,
  Wrench,
  MapPin,
  DollarSign,
  Check,
  X,
  Navigation2,
  Power,
  Briefcase,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/ui/input';
import { formatGhs } from '@/lib/currency';
import { serviceTypeConfig } from '@/lib/service-config';
import { StarRatingDisplay } from '@/components/ratings/star-rating';
import { PaginationBar } from '@/components/ui/pagination';
import { useAvailableJobs, useRequests } from '@/hooks/useApi';
import { mechanicsApi, requestsApi } from '@/api/repositories';
import type { RequestStatus, RescueRequestDto } from '@/api/types';
import { useToast } from '@/components/ui/toast';
import { nextJobAction, canCancelJob } from '@/lib/job-status';
import { ApiClientError } from '@/api/client/http';
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

const ACTIVE_STATUSES = new Set(['accepted', 'enroute', 'arrived', 'inprogress']);

function vehicleLabel(req: RescueRequestDto): string {
  if (!req.vehicle) return 'Vehicle details pending';
  return `${req.vehicle.year} ${req.vehicle.make} ${req.vehicle.vehicleModel} · ${req.vehicle.registrationNumber}`;
}

function customerLabel(req: RescueRequestDto): string {
  const user = req.customer?.userId;
  if (!user) return 'Customer';
  return `${user.firstName} ${user.lastName}`;
}

export function MechanicHome({
  onAcceptJob,
  onOpenJob,
}: {
  onAcceptJob: (job: RescueRequestDto) => void;
  onOpenJob: (job: RescueRequestDto) => void;
}) {
  const { toast } = useToast();
  const [applicationStatus, setApplicationStatus] = React.useState<string | null>(null);
  const [online, setOnline] = React.useState(false);
  const { data: availableJobs, loading, error, reload, accept } = useAvailableJobs({
    pollMs: 30000,
    enabled: applicationStatus === 'verified' && online,
  });
  const { data: myRequests, reload: reloadMine } = useRequests({ pollMs: 30000 });
  const [availabilityLoading, setAvailabilityLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'available' | 'active'>('available');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [declinedIds, setDeclinedIds] = React.useState<Set<string>>(new Set());

  const activeJobs = myRequests.filter((job) => ACTIVE_STATUSES.has(job.status));
  const visibleAvailable = availableJobs.filter((job) => !declinedIds.has(job._id));

  React.useEffect(() => {
    let active = true;
    void mechanicsApi
      .profile()
      .then((profile) => {
        if (active) {
          setOnline(profile.availability);
          setApplicationStatus(profile.verificationStatus ?? 'pending');
        }
      })
      .catch((err) => {
        if (active) {
          toast({
            type: 'error',
            title: 'Could not load availability',
            description: err instanceof Error ? err.message : 'Try again',
          });
        }
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const toggleOnline = async () => {
    if (availabilityLoading) return;
    const next = !online;
    setOnline(next);
    try {
      await mechanicsApi.setAvailability(next);
    } catch (err) {
      setOnline(!next);
      toast({
        type: 'error',
        title: 'Could not update availability',
        description: err instanceof Error ? err.message : 'Try again',
      });
    }
  };

  const handleAccept = async (job: RescueRequestDto) => {
    setBusyId(job._id);
    try {
      const accepted = await accept(job._id);
      await Promise.all([reload(), reloadMine()]);
      setActiveTab('active');
      toast({
        type: 'success',
        title: 'Job accepted',
        description: `Navigate to ${accepted.pickupLocation.address}.`,
      });
      onAcceptJob(accepted);
    } catch (err) {
      toast({
        type: 'error',
        title: 'Accept failed',
        description: err instanceof Error ? err.message : 'Try another job',
      });
    } finally {
      setBusyId(null);
    }
  };

  const advanceStatus = async (job: RescueRequestDto, status: RequestStatus) => {
    setBusyId(job._id);
    try {
      await requestsApi.updateStatus(job._id, status);
      await reloadMine();
      const action = nextJobAction(job.status);
      toast({
        type: 'success',
        title: action?.successTitle ?? 'Status updated',
        description:
          status === 'completed'
            ? 'Payment recorded for this service.'
            : action?.successDescription,
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Update failed',
        description: err instanceof ApiClientError ? err.message : 'Try again',
      });
    } finally {
      setBusyId(null);
    }
  };

  const cancelActiveJob = async (job: RescueRequestDto) => {
    setBusyId(job._id);
    try {
      await requestsApi.updateStatus(job._id, 'cancelled');
      await Promise.all([reload(), reloadMine()]);
      toast({
        type: 'success',
        title: 'Job cancelled',
        description: 'The customer has been notified.',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Cancel failed',
        description: err instanceof ApiClientError ? err.message : 'Try again',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (!availabilityLoading && applicationStatus !== 'verified') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-lg">
          <div className="space-y-4 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-50 text-warning dark:bg-warning-700/20">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Verification pending</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your selfie, Ghana Card, and mechanic details are being reviewed. You can go online
                and accept jobs after approval.
              </p>
            </div>
            <Badge variant="warning">{applicationStatus ?? 'pending'}</Badge>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <Card
        className={cn(
          'overflow-hidden border-0 transition-colors',
          online
            ? 'bg-gradient-to-br from-foreground to-foreground/80 text-background dark:from-zinc-800 dark:to-zinc-900'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full',
                    online ? 'bg-primary text-primary-foreground' : 'bg-accent',
                  )}
                >
                  <Power className="h-6 w-6" />
                </div>
                {online && (
                  <span className="absolute -inset-1 rounded-full border-2 border-primary/40 animate-pulse-ring" />
                )}
              </div>
              <div>
                <p className="font-display text-lg font-bold">
                  {online ? "You're Online" : "You're Offline"}
                </p>
                <p className={cn('text-sm', online ? 'text-background/60 dark:text-zinc-400' : 'opacity-80')}>
                  {online ? 'Receiving job requests' : 'Tap to go online'}
                </p>
              </div>
            </div>
            <button
              onClick={() => void toggleOnline()}
              disabled={availabilityLoading}
              className={cn(
                'relative h-8 w-14 rounded-full transition-colors',
                online ? 'bg-primary' : 'bg-accent',
                availabilityLoading && 'cursor-not-allowed opacity-50',
              )}
            >
              <span
                className={cn(
                  'absolute top-1 h-6 w-6 rounded-full bg-white shadow-soft transition-transform',
                  online ? 'translate-x-7' : 'translate-x-1',
                )}
              />
            </button>
          </div>
          {online && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-2xl font-bold">{visibleAvailable.length}</p>
                <p className="text-xs text-background/60 dark:text-zinc-400">Available jobs</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{activeJobs.length}</p>
                <p className="text-xs text-background/60 dark:text-zinc-400">Active jobs</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{activeJobs.length ? 'Live' : 'Idle'}</p>
                <p className="text-xs text-background/60 dark:text-zinc-400">Queue status</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-1 rounded-full bg-muted p-1">
        <button
          onClick={() => setActiveTab('available')}
          className={cn(
            'flex-1 rounded-full py-2 text-sm font-semibold transition-all',
            activeTab === 'available' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground',
          )}
        >
          Available ({visibleAvailable.length})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            'flex-1 rounded-full py-2 text-sm font-semibold transition-all',
            activeTab === 'active' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground',
          )}
        >
          Active ({activeJobs.length})
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading jobs…</p>
      ) : error ? (
        <EmptyState icon={<Briefcase className="h-10 w-10" />} title="Could not load jobs" description={error} />
      ) : activeTab === 'available' ? (
        visibleAvailable.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-10 w-10" />}
            title="No jobs available"
            description="New job requests across Accra will appear here. Stay online to receive them."
          />
        ) : (
          <div className="space-y-3">
            {visibleAvailable.map((job) => {
              const config = serviceTypeConfig[job.serviceType];
              const Icon = iconMap[config?.icon ?? 'Wrench'] ?? Wrench;
              return (
                <Card key={job._id} className="overflow-hidden animate-fade-in-up">
                  <div className="h-1 bg-primary animate-pulse-soft" />
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-foreground">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold">{config?.label ?? job.serviceType}</p>
                          <Badge variant="primary" dot>
                            New
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{vehicleLabel(job)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {job.pickupLocation.address}, {job.pickupLocation.city}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="md"
                        className="flex-1"
                        onClick={() =>
                          setDeclinedIds((prev) => new Set(prev).add(job._id))
                        }
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        className="flex-[2]"
                        disabled={busyId === job._id || !online || availabilityLoading}
                        onClick={() => void handleAccept(job)}
                      >
                        <Check className="h-4 w-4" />
                        {busyId === job._id ? 'Accepting…' : 'Accept Job'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : activeJobs.length === 0 ? (
        <EmptyState
          icon={<Navigation2 className="h-10 w-10" />}
          title="No active jobs"
          description="Accepted rescues will show here with navigation and status controls."
        />
      ) : (
        <div className="space-y-3">
          {activeJobs.map((job) => {
            const config = serviceTypeConfig[job.serviceType];
            const Icon = iconMap[config?.icon ?? 'Wrench'] ?? Wrench;
            const next = nextJobAction(job.status);
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${job.pickupLocation.latitude},${job.pickupLocation.longitude}`;
            return (
              <Card key={job._id} className="overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning dark:bg-warning-700/20 dark:text-warning-500">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{config?.label ?? job.serviceType}</p>
                        <StatusChip status={job.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {customerLabel(job)} · {vehicleLabel(job)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl bg-accent p-3">
                    <Navigation2 className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {job.pickupLocation.address}, {job.pickupLocation.city}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {next ? `Next: ${next.label}` : 'Open job details'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => window.open(mapsUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Navigate
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => {
                        const phone = job.customer?.userId?.phone;
                        if (phone) window.location.href = `tel:${phone}`;
                      }}
                    >
                      Call Customer
                    </Button>
                    <Button variant="outline" size="md" onClick={() => onOpenJob(job)}>
                      Open Job
                    </Button>
                  </div>

                  {next && (
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      disabled={busyId === job._id}
                      onClick={() => void advanceStatus(job, next.status)}
                    >
                      {busyId === job._id ? 'Updating…' : next.label}
                    </Button>
                  )}

                  {canCancelJob(job.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive"
                      disabled={busyId === job._id}
                      onClick={() => void cancelActiveJob(job)}
                    >
                      Cancel job
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MechanicEarnings() {
  const [earnings, setEarnings] = React.useState<Awaited<ReturnType<typeof mechanicsApi.earnings>> | null>(null);
  const [earningsLoading, setEarningsLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        setEarnings(await mechanicsApi.earnings());
      } finally {
        setEarningsLoading(false);
      }
    })();
  }, []);

  if (earningsLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading payments & earnings…</p>;
  }

  const payoutInfo = earnings?.payoutInfo;

  return (
    <div className="space-y-4 pb-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-foreground to-foreground/80 text-background dark:from-zinc-800 dark:to-zinc-900">
        <div className="p-5 space-y-4">
          <div>
            <p className="text-sm text-background/60 dark:text-zinc-400">Payments & Earnings</p>
            <p className="font-display text-3xl font-bold mt-1">{formatGhs(earnings?.totalEarnings ?? 0)}</p>
            <p className="text-sm text-background/60 dark:text-zinc-400 mt-1">
              {earnings?.completedJobs ?? 0} completed services · ⭐ {earnings?.rating != null ? earnings.rating.toFixed(1) : '—'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-background/10 p-3">
              <p className="text-xs text-background/60 dark:text-zinc-400">Pending settlement</p>
              <p className="font-semibold mt-1">{formatGhs(earnings?.pendingPayments ?? 0)}</p>
            </div>
            <div className="rounded-xl bg-background/10 p-3">
              <p className="text-xs text-background/60 dark:text-zinc-400">Settled payments</p>
              <p className="font-semibold mt-1">{formatGhs(earnings?.settledPayments ?? 0)}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-border bg-accent/30">
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">{earnings?.disclaimer}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-sm">Payment account</p>
              <p className="text-sm text-muted-foreground mt-0.5">{payoutInfo?.message}</p>
            </div>
            {payoutInfo?.configured && payoutInfo.managementUrl ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => window.open(payoutInfo.managementUrl, '_blank', 'noopener,noreferrer')}
              >
                Manage payouts
              </Button>
            ) : (
              <Button variant="outline" size="md" disabled>
                Payment account
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div>
        <h3 className="font-display text-base font-bold mb-3 px-1">Recent payments</h3>
        {(earnings?.recentPayments?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<DollarSign className="h-10 w-10" />}
            title="No in-app job payments"
            description="Customers pay you directly. Road Rescue does not collect mechanic service payments."
          />
        ) : (
          <div className="space-y-2">
            {earnings?.recentPayments?.map((payment) => (
              <Card key={payment.id}>
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">Service payment</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString('en-GH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">Payment: {formatPaymentStatus(payment.paymentStatus)}</Badge>
                      <Badge variant="outline">
                        Settlement: {formatSettlementStatus(payment.settlementStatus)}
                      </Badge>
                    </div>
                  </div>
                  <p className="font-bold text-success shrink-0">{formatGhs(payment.providerAmount)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MechanicJobHistory() {
  const [jobs, setJobs] = React.useState<RescueRequestDto[]>([]);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [limit] = React.useState(20);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const reload = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await mechanicsApi.jobHistory({
        page,
        limit,
        q: debouncedSearch || undefined,
      });
      setJobs(ensureArray(result.items));
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load job history');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  if (loading && jobs.length === 0 && !error) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading job history…</p>;
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Job History</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Completed Road Rescue jobs assigned to you.
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search jobs, customers or locations"
          className="pl-9"
        />
      </div>
      {error ? (
        <EmptyState
          icon={<Briefcase className="h-10 w-10" />}
          title="Could not load job history"
          description={error}
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-10 w-10" />}
          title={debouncedSearch ? 'No matching jobs' : 'No completed jobs yet.'}
          description={
            debouncedSearch
              ? 'Try a different service type, city, or address.'
              : "Completed services will appear here once you've finished your first Road Rescue job."
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const rating = job.customerRating;
            return (
              <Card key={job._id}>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {serviceTypeConfig[job.serviceType]?.label ?? job.serviceType}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">Customer: {customerLabel(job)}</p>
                      <p className="text-sm text-muted-foreground">
                        Location: {job.pickupLocation.city}
                      </p>
                      {job.description && (
                        <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
                      )}
                    </div>
                    <StatusChip status={job.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Completed:{' '}
                    {new Date(job.completedAt ?? job.updatedAt ?? job.createdAt).toLocaleDateString('en-GH', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-semibold mb-1">Customer Rating</p>
                    {rating ? (
                      <div className="space-y-1">
                        <StarRatingDisplay stars={rating.stars} />
                        {rating.review && (
                          <p className="text-sm text-muted-foreground">“{rating.review}”</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not yet rated</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}

function formatPaymentStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatSettlementStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
