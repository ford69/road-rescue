import * as React from 'react';
import {
  Truck,
  BatteryCharging,
  CircleDot,
  KeyRound,
  Fuel,
  AlertTriangle,
  Wrench,
  Search,
  MapPin,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { serviceTypeConfig, mechanicDisplayName, mechanicInitials } from '@/lib/service-config';
import { StarRatingDisplay } from '@/components/ratings/star-rating';
import { RateProviderSheet } from '@/components/ratings/rate-provider-sheet';
import { PaginationBar } from '@/components/ui/pagination';
import { requestsApi } from '@/api/repositories';
import type { RescueRequestDto } from '@/api/types';
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

type FilterTab = 'all' | 'completed' | 'cancelled';

export function ServiceHistory({
  onSelectRequest,
}: {
  onSelectRequest: (req: RescueRequestDto) => void;
}) {
  const [requests, setRequests] = React.useState<RescueRequestDto[]>([]);
  const [filter, setFilter] = React.useState<FilterTab>('all');
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [limit] = React.useState(20);
  const [counts, setCounts] = React.useState({ total: 0, completed: 0, cancelled: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [ratingRequest, setRatingRequest] = React.useState<RescueRequestDto | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch]);

  const reload = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await requestsApi.history({
        page,
        limit,
        q: debouncedSearch || undefined,
        status: filter === 'all' ? undefined : filter,
      });
      setRequests(ensureArray(result.items));
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setCounts(result.counts ?? { total: 0, completed: 0, cancelled: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filter, debouncedSearch]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  if (loading && requests.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading service history…</p>;
  }

  if (error) {
    return (
      <EmptyState icon={<Wrench className="h-10 w-10" />} title="Could not load history" description={error} />
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="font-display text-2xl font-bold mt-1">{counts.completed}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">Services</p>
            <p className="font-display text-2xl font-bold mt-1">{counts.total}</p>
          </div>
        </Card>
      </div>

      <Input
        placeholder="Search by service or location..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        icon={<Search className="h-4 w-4" />}
      />

      <div className="flex items-center gap-1 rounded-full bg-muted p-1">
        {(['all', 'completed', 'cancelled'] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              'flex-1 rounded-full py-2 text-sm font-semibold capitalize transition-all',
              filter === t ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-10 w-10" />}
          title={debouncedSearch ? 'No matching services' : 'No service history'}
          description={
            debouncedSearch
              ? 'Try a different service type or location.'
              : 'Your past requests will appear here once you use the service.'
          }
          action={<Button variant="primary">Request Assistance</Button>}
        />
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const config = serviceTypeConfig[req.serviceType];
            const Icon = iconMap[config.icon] ?? Wrench;
            const mechanicName = req.mechanic ? mechanicDisplayName(req.mechanic) : null;
            return (
              <Card key={req._id} interactive onClick={() => onSelectRequest(req)}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{config.label}</p>
                        <StatusChip status={req.status} />
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {req.pickupLocation.address}, {req.pickupLocation.city}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        {mechanicName && (
                          <div className="flex items-center gap-1.5">
                            <Avatar fallback={mechanicInitials(mechanicName)} size="xs" />
                            <span className="text-xs font-medium">{mechanicName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(req.createdAt).toLocaleDateString('en-GH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      {req.status === 'awaiting_confirmation' && (
                        <Button
                          size="sm"
                          className="mt-3"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectRequest(req);
                          }}
                        >
                          Review Service
                        </Button>
                      )}
                      {req.status === 'completed' && (
                        <div className="mt-3 space-y-1">
                          {req.customerRating ? (
                            <>
                              <StarRatingDisplay stars={req.customerRating.stars} />
                              {req.customerRating.review && (
                                <p className="text-xs text-muted-foreground">
                                  Your review: “{req.customerRating.review}”
                                </p>
                              )}
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                setRatingRequest(req);
                              }}
                            >
                              Rate Provider
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
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
      <RateProviderSheet
        request={ratingRequest}
        open={Boolean(ratingRequest)}
        onOpenChange={(open) => {
          if (!open) setRatingRequest(null);
        }}
        onRated={() => void reload()}
      />
    </div>
  );
}
