import * as React from 'react';
import {
  DollarSign,
  Truck,
  BatteryCharging,
  CircleDot,
  KeyRound,
  Fuel,
  AlertTriangle,
  Wrench,
  Clock,
  Star,
  Filter,
  Download,
  Activity,
  UserCheck,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import { MapView } from '@/components/map-view';
import { EmptyState } from '@/components/empty-state';
import { formatGhs } from '@/lib/currency';
import { serviceTypeConfig, mechanicDisplayName, mechanicInitials } from '@/lib/service-config';
import { useAdminDashboard } from '@/hooks/useApi';
import { adminApi } from '@/api/repositories';
import { useToast } from '@/components/ui/toast';
import { MechanicVerificationSheet } from '@/components/admin/mechanic-verification-sheet';
import type { MechanicDto } from '@/api/types';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Truck,
  BatteryCharging,
  CircleDot,
  KeyRound,
  Fuel,
  AlertTriangle,
  Wrench,
};

export function AdminDashboard() {
  const { toast } = useToast();
  const { data, loading, error, reload } = useAdminDashboard();
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);
  const [selectedMechanic, setSelectedMechanic] = React.useState<MechanicDto | null>(null);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading dashboard…</p>;
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<Activity className="h-10 w-10" />}
        title="Could not load admin dashboard"
        description={error ?? 'Try signing in as an administrator.'}
      />
    );
  }

  const liveJobs = data.liveJobs;
  const mechanics = data.mechanics;
  const onlineMechanics = mechanics.filter((m) => m.availability).length;
  const pendingMechanics = mechanics.filter((m) => m.verificationStatus === 'pending');

  const reviewMechanic = async (
    mechanicId: string,
    status: 'verified' | 'rejected',
  ) => {
    setReviewingId(mechanicId);
    try {
      await adminApi.verifyMechanic(mechanicId, status);
      await reload();
      setSelectedMechanic(null);
      toast({
        type: 'success',
        title: status === 'verified' ? 'Mechanic approved' : 'Application rejected',
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Review failed',
        description: error instanceof Error ? error.message : 'Try again',
      });
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time overview of Road Rescue Ghana
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button size="md">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Live Jobs"
          value={String(data.kpis.liveJobs)}
          change={`${data.kpis.customers} customers`}
          trend="up"
          icon={<Activity className="h-5 w-5" />}
          color="primary"
        />
        <KPICard
          label="Revenue"
          value={formatGhs(data.kpis.revenueGhs)}
          change="Paid jobs"
          trend="up"
          icon={<DollarSign className="h-5 w-5" />}
          color="success"
        />
        <KPICard
          label="Online Mechanics"
          value={String(onlineMechanics)}
          change={`${data.kpis.mechanics} total`}
          trend="up"
          icon={<UserCheck className="h-5 w-5" />}
          color="warning"
        />
        <KPICard
          label="Avg Response"
          value="7.2m"
          change="Accra network"
          trend="up"
          icon={<Clock className="h-5 w-5" />}
          color="primary"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-bold">Live Jobs</h3>
                <p className="text-sm text-muted-foreground">{liveJobs.length} active requests</p>
              </div>
              <Badge variant="primary" dot>
                Live
              </Badge>
            </div>

            {liveJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No live jobs right now.</p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Customer
                        </th>
                        <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Service
                        </th>
                        <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Mechanic
                        </th>
                        <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Status
                        </th>
                        <th className="pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {liveJobs.map((job) => {
                        const config = serviceTypeConfig[job.serviceType];
                        const Icon = iconMap[config.icon] ?? Wrench;
                        const customer = job.customer?.userId
                          ? `${job.customer.userId.firstName} ${job.customer.userId.lastName}`
                          : 'Customer';
                        const mechanic = job.mechanic ? mechanicDisplayName(job.mechanic) : 'Unassigned';
                        return (
                          <tr key={job._id} className="hover:bg-accent/50 transition-colors">
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <Avatar fallback={mechanicInitials(customer)} size="sm" />
                                <div>
                                  <p className="font-semibold text-sm">{customer}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {job.pickupLocation.city}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{config.label}</span>
                              </div>
                            </td>
                            <td className="py-3 text-sm font-medium">{mechanic}</td>
                            <td className="py-3">
                              <StatusChip status={job.status} />
                            </td>
                            <td className="py-3 text-right font-bold text-sm">
                              {formatGhs(job.quotedPrice)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-2">
                  {liveJobs.map((job) => {
                    const config = serviceTypeConfig[job.serviceType];
                    const customer = job.customer?.userId
                      ? `${job.customer.userId.firstName} ${job.customer.userId.lastName}`
                      : 'Customer';
                    const mechanic = job.mechanic ? mechanicDisplayName(job.mechanic) : 'Unassigned';
                    return (
                      <div key={job._id} className="rounded-xl border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{customer}</span>
                          <StatusChip status={job.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {config.label} · {mechanic}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {job.pickupLocation.address}
                          </span>
                          <span className="font-bold">{formatGhs(job.quotedPrice)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-5">
            <h3 className="font-display text-base font-bold mb-1">Live Map</h3>
            <p className="text-sm text-muted-foreground mb-3">Active technicians across Accra</p>
            <MapView
              className="h-64 min-h-[16rem] w-full rounded-xl border border-border landscape:h-[40dvh] landscape:min-h-[12rem]"
              markers={mechanics.slice(0, 4).map((m) => ({
                id: m._id,
                latitude: m.latitude,
                longitude: m.longitude,
                type: 'mechanic' as const,
                label: mechanicDisplayName(m).split(' ')[0],
              }))}
            />
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold">Mechanic Onboarding</h3>
              <p className="text-sm text-muted-foreground">
                Review identity and service applications.
              </p>
            </div>
            <Badge variant={pendingMechanics.length ? 'warning' : 'success'}>
              {pendingMechanics.length} pending
            </Badge>
          </div>

          {pendingMechanics.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-accent/50 p-4">
              <ShieldCheck className="h-5 w-5 text-success" />
              <p className="text-sm text-muted-foreground">
                All mechanic applications have been reviewed.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {pendingMechanics.slice(0, 6).map((mechanic) => {
                const name = mechanicDisplayName(mechanic);
                return (
                  <button
                    key={mechanic._id}
                    type="button"
                    onClick={() => setSelectedMechanic(mechanic)}
                    className="rounded-xl border border-border p-4 text-left transition-colors hover:border-brand-blue hover:bg-muted/40"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={mechanic.userId?.avatar}
                        alt={name}
                        fallback={mechanicInitials(name)}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {mechanic.garageName} · {mechanic.experience ?? 0} years
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {mechanic.ghanaCardNumber
                            ? `Ghana Card: ${mechanic.ghanaCardNumber.slice(0, 7)}••••••`
                            : 'Ghana Card unavailable'}
                        </p>
                      </div>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {mechanic.specialties?.map((specialty) => (
                        <Badge key={specialty} variant="subtle">
                          {serviceTypeConfig[specialty]?.label ?? specialty}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-semibold text-brand-blue">Tap to review details</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <MechanicVerificationSheet
        mechanic={selectedMechanic}
        open={Boolean(selectedMechanic)}
        onClose={() => setSelectedMechanic(null)}
        busy={Boolean(selectedMechanic && reviewingId === selectedMechanic._id)}
        onApprove={() => selectedMechanic && void reviewMechanic(selectedMechanic._id, 'verified')}
        onReject={() => selectedMechanic && void reviewMechanic(selectedMechanic._id, 'rejected')}
      />

      <Card>
        <div className="p-5">
          <h3 className="font-display text-base font-bold mb-4">Mechanics</h3>
          <div className="space-y-2">
            {mechanics.slice(0, 6).map((m) => {
              const name = mechanicDisplayName(m);
              return (
                <div key={m._id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Avatar src={m.userId?.avatar} fallback={mechanicInitials(name)} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.location.address}, {m.location.city}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      <span className="text-sm font-bold">{m.rating.toFixed(1)}</span>
                    </div>
                    <Badge variant={m.availability ? 'success' : 'subtle'}>
                      {m.availability ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

function KPICard({
  label,
  value,
  change,
  trend,
  icon,
  color,
}: {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning';
}) {
  return (
    <Card>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl',
              color === 'primary' && 'bg-accent text-foreground',
              color === 'success' && 'bg-success-50 text-success dark:bg-success-700/20',
              color === 'warning' && 'bg-warning-50 text-warning dark:bg-warning-700/20',
            )}
          >
            {icon}
          </div>
          {trend === 'up' ? (
            <ArrowUpRight className="h-4 w-4 text-success" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-critical" />
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold mt-1">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{change}</p>
        </div>
      </div>
    </Card>
  );
}
