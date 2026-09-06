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
import { serviceTypeConfig, mechanicDisplayName, mechanicInitials } from '@/lib/service-config';
import { useRequests } from '@/hooks/useApi';
import type { RescueRequestDto } from '@/api/types';

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
  const { data: requests, loading, error } = useRequests();
  const [filter, setFilter] = React.useState<FilterTab>('all');
  const [search, setSearch] = React.useState('');

  const filtered = requests.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const config = serviceTypeConfig[r.serviceType];
      const haystack = `${config.label} ${r.pickupLocation.address} ${r.pickupLocation.city}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    }
    return true;
  });

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
        <Card>
          <div className="p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="font-display text-2xl font-bold mt-1">
              {requests.filter((r) => r.status === 'completed').length}
            </p>
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
                    </div>
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
