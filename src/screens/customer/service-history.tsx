import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Truck,
  BatteryCharging,
  CircleDot,
  KeyRound,
  Fuel,
  AlertTriangle,
  Wrench,
  Search,
  Star,
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
import { formatGhs } from '@/lib/currency';
import { serviceTypeConfig, mechanicDisplayName, mechanicInitials } from '@/lib/service-config';
import { useRequests } from '@/hooks/useApi';
import type { RescueRequestDto } from '@/api/types';
import { paymentsApi } from '@/api/repositories';
import { useToast } from '@/components/ui/toast';

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
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: requests, loading, error, reload } = useRequests();
  const [filter, setFilter] = React.useState<FilterTab>('all');
  const [search, setSearch] = React.useState('');
  const [payingId, setPayingId] = React.useState<string | null>(null);
  const paymentReference =
    searchParams.get('reference') ?? searchParams.get('trxref');

  React.useEffect(() => {
    if (!paymentReference) return;
    void paymentsApi
      .verify(paymentReference)
      .then(async () => {
        await reload();
        toast({
          type: 'success',
          title: 'Payment successful',
          description: 'Your receipt is now available in service history.',
        });
      })
      .catch((paymentError) => {
        toast({
          type: 'error',
          title: 'Payment verification failed',
          description:
            paymentError instanceof Error ? paymentError.message : 'Try again',
        });
      })
      .finally(() => setSearchParams({}, { replace: true }));
  }, [paymentReference, reload, setSearchParams, toast]);

  const startPayment = async (requestId: string) => {
    setPayingId(requestId);
    try {
      const payment = await paymentsApi.initialize(requestId);
      window.location.assign(payment.authorizationUrl);
    } catch (paymentError) {
      toast({
        type: 'error',
        title: 'Could not start payment',
        description: paymentError instanceof Error ? paymentError.message : 'Try again',
      });
      setPayingId(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const config = serviceTypeConfig[r.serviceType];
      const haystack = `${config.label} ${r.pickupLocation.address} ${r.pickupLocation.city}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    }
    return true;
  });

  const totalSpent = requests
    .filter((r) => r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + (r.quotedPrice ?? 0), 0);

  if (loading) {
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
        <Card className="bg-gradient-to-br from-foreground to-foreground/80 border-0 text-background dark:from-zinc-800 dark:to-zinc-900">
          <div className="p-4">
            <p className="text-sm text-background/60 dark:text-zinc-400">Total Spent</p>
            <p className="font-display text-2xl font-bold mt-1">{formatGhs(totalSpent)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">Services</p>
            <p className="font-display text-2xl font-bold mt-1">{requests.length}</p>
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-10 w-10" />}
          title="No service history"
          description="Your past requests will appear here once you use the service."
          action={<Button variant="primary">Request Assistance</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => {
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
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{formatGhs(req.quotedPrice)}</p>
                      <p
                        className={cn(
                          'mt-1 text-xs font-semibold',
                          req.paymentStatus === 'paid' ? 'text-success' : 'text-warning',
                        )}
                      >
                        {req.paymentStatus === 'paid' ? 'Paid' : 'Payment due'}
                      </p>
                      {req.status === 'completed' && req.paymentStatus !== 'paid' && (
                        <Button
                          size="sm"
                          className="mt-2"
                          disabled={payingId === req._id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void startPayment(req._id);
                          }}
                        >
                          {payingId === req._id ? 'Opening…' : 'Pay now'}
                        </Button>
                      )}
                      {req.status === 'completed' && (
                        <div className="flex items-center gap-0.5 justify-end mt-1">
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          <Star className="h-3 w-3 fill-warning text-warning" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
