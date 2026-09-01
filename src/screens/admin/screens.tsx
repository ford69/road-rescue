import * as React from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  MapPin,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Users,
  Wrench,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusChip } from '@/components/ui/status-chip';
import { EmptyState } from '@/components/empty-state';
import { MapView } from '@/components/map-view';
import { useAdminDashboard } from '@/hooks/useApi';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';
import { adminApi } from '@/api/repositories';
import { formatGhs } from '@/lib/currency';
import { mechanicDisplayName, mechanicInitials, serviceTypeConfig } from '@/lib/service-config';
import type { AdminDashboardDto, MechanicDto } from '@/api/types';
import { MechanicVerificationSheet } from '@/components/admin/mechanic-verification-sheet';

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function AdminState({
  children,
}: {
  children: (data: AdminDashboardDto, reload: () => Promise<void>) => React.ReactNode;
}) {
  const { data, loading, error, reload } = useAdminDashboard();
  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading admin data…</p>;
  }
  if (error || !data) {
    return (
      <EmptyState
        icon={<Activity className="h-10 w-10" />}
        title="Could not load admin data"
        description={error ?? 'Try signing in again.'}
      />
    );
  }
  return <>{children(data, reload)}</>;
}

export function AdminLiveJobs() {
  return (
    <AdminState>
      {(data) => (
        <div className="space-y-5 pb-4">
          <PageHeader
            title="Live Jobs"
            description="Monitor active rescue requests across the network."
            action={
              <Badge variant="primary" dot>
                {data.liveJobs.length} active
              </Badge>
            }
          />

          <Card className="overflow-hidden">
            <MapView
              className="h-72 border-b border-border"
              markers={data.mechanics
                .filter((mechanic) => mechanic.availability)
                .slice(0, 8)
                .map((mechanic) => ({
                  id: mechanic._id,
                  latitude: mechanic.latitude,
                  longitude: mechanic.longitude,
                  type: 'mechanic' as const,
                  label: mechanicDisplayName(mechanic).split(' ')[0],
                }))}
            />
            <div className="divide-y divide-border">
              {data.liveJobs.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No active jobs.</p>
              ) : (
                data.liveJobs.map((job) => {
                  const customer = job.customer?.userId
                    ? `${job.customer.userId.firstName} ${job.customer.userId.lastName}`
                    : 'Customer';
                  return (
                    <div key={job._id} className="grid gap-3 p-4 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{customer}</p>
                          <StatusChip status={job.status} />
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.pickupLocation.address}, {job.pickupLocation.city}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {serviceTypeConfig[job.serviceType]?.label ?? job.serviceType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {job.mechanic ? mechanicDisplayName(job.mechanic) : 'Awaiting mechanic'}
                        </p>
                      </div>
                      <p className="font-display text-lg font-bold">{formatGhs(job.quotedPrice)}</p>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}
    </AdminState>
  );
}

export function AdminUsers() {
  const [query, setQuery] = React.useState('');
  return (
    <AdminState>
      {(data) => {
        const users = data.customers.filter((customer) => {
          const user = customer.userId;
          const text = `${user?.firstName ?? ''} ${user?.lastName ?? ''} ${user?.email ?? ''} ${user?.phone ?? ''}`;
          return text.toLowerCase().includes(query.toLowerCase());
        });
        return (
          <div className="space-y-5 pb-4">
            <PageHeader title="Users" description={`${data.kpis.customers} registered customers.`} />
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email or phone"
              />
            </div>
            <Card className="divide-y divide-border overflow-hidden">
              {users.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No users found.</p>
              ) : (
                users.map((customer) => {
                  const user = customer.userId;
                  const name = user ? `${user.firstName} ${user.lastName}` : 'Customer';
                  return (
                    <div key={customer._id} className="flex items-center gap-3 p-4">
                      <Avatar fallback={mechanicInitials(name)} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {user?.email ?? 'No email'} · {user?.phone ?? 'No phone'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={user?.status === 'suspended' ? 'critical' : 'success'}>
                          {user?.status ?? 'active'}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {user?.emailVerified ? 'Verified email' : 'Email unverified'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
          </div>
        );
      }}
    </AdminState>
  );
}

export function AdminMechanics() {
  const { toast } = useToast();
  const [filter, setFilter] = React.useState<'all' | 'online' | 'pending'>('all');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [selectedMechanic, setSelectedMechanic] = React.useState<MechanicDto | null>(null);

  const reviewMechanic = async (
    mechanicId: string,
    status: 'verified' | 'rejected',
    reload: () => Promise<void>,
  ) => {
    setBusyId(mechanicId);
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
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Try again',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminState>
      {(data, reload) => {
        const mechanics = data.mechanics.filter((mechanic) => {
          if (filter === 'online') return mechanic.availability;
          if (filter === 'pending') return mechanic.verificationStatus === 'pending';
          return true;
        });
        return (
          <div className="space-y-5 pb-4">
            <PageHeader
              title="Mechanics"
              description={`${data.kpis.mechanics} mechanics registered on the platform.`}
            />
            <div className="flex gap-2">
              {(['all', 'online', 'pending'] as const).map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={filter === item ? 'primary' : 'outline'}
                  onClick={() => setFilter(item)}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {mechanics.map((mechanic) => {
                const name = mechanicDisplayName(mechanic);
                const verification = mechanic.verificationStatus ?? 'pending';
                return (
                  <Card
                    key={mechanic._id}
                    interactive={verification === 'pending'}
                    onClick={() => verification === 'pending' && setSelectedMechanic(mechanic)}
                  >
                    <div className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        <Avatar
                          src={mechanic.userId?.avatar}
                          alt={name}
                          fallback={mechanicInitials(name)}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{name}</p>
                          <p className="truncate text-sm text-muted-foreground">{mechanic.garageName}</p>
                        </div>
                        <Badge
                          variant={
                            verification === 'verified'
                              ? 'success'
                              : verification === 'rejected'
                                ? 'critical'
                                : 'warning'
                          }
                        >
                          {verification}
                        </Badge>
                      </div>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {mechanic.location.address}, {mechanic.location.city}
                      </p>
                      {mechanic.ghanaCardNumber && (
                        <p className="text-xs text-muted-foreground">
                          Ghana Card: {mechanic.ghanaCardNumber.slice(0, 7)}••••••
                        </p>
                      )}
                      {verification === 'pending' && (
                        <p className="text-xs font-semibold text-brand-blue">Tap to review details</p>
                      )}
                      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-warning text-warning" />
                          {mechanic.rating.toFixed(1)} · {mechanic.completedJobs} jobs
                        </span>
                        <Badge variant={mechanic.availability ? 'primary' : 'subtle'} dot={mechanic.availability}>
                          {mechanic.availability ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            <MechanicVerificationSheet
              mechanic={selectedMechanic}
              open={Boolean(selectedMechanic)}
              onClose={() => setSelectedMechanic(null)}
              busy={Boolean(selectedMechanic && busyId === selectedMechanic._id)}
              onApprove={() =>
                selectedMechanic && void reviewMechanic(selectedMechanic._id, 'verified', reload)
              }
              onReject={() =>
                selectedMechanic && void reviewMechanic(selectedMechanic._id, 'rejected', reload)
              }
            />
          </div>
        );
      }}
    </AdminState>
  );
}

export function AdminPayments() {
  return (
    <AdminState>
      {(data) => {
        const paid = data.payments.filter((payment) => payment.status === 'paid');
        const pending = data.payments.filter((payment) => payment.status === 'pending');
        return (
          <div className="space-y-5 pb-4">
            <PageHeader
              title="Payments"
              description="Review service transactions and payment status."
              action={
                <Button variant="outline" size="md">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              }
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <SummaryCard icon={<CreditCard />} label="Total paid" value={formatGhs(paid.reduce((sum, item) => sum + item.amount, 0))} />
              <SummaryCard icon={<CheckCircle2 />} label="Paid transactions" value={String(paid.length)} />
              <SummaryCard icon={<Clock />} label="Pending" value={String(pending.length)} />
            </div>
            <Card className="divide-y divide-border overflow-hidden">
              {data.payments.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                data.payments.map((payment) => (
                  <div key={payment._id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div>
                      <p className="font-mono text-sm font-semibold">
                        {payment.transactionReference ?? payment._id.slice(-10).toUpperCase()}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {payment.paymentMethod.replace('_', ' ')} ·{' '}
                        {new Date(payment.createdAt).toLocaleDateString('en-GH')}
                      </p>
                    </div>
                    <Badge
                      variant={
                        payment.status === 'paid'
                          ? 'success'
                          : payment.status === 'failed'
                            ? 'critical'
                            : payment.status === 'refunded'
                              ? 'warning'
                              : 'subtle'
                      }
                    >
                      {payment.status}
                    </Badge>
                    <p className="font-display text-lg font-bold">{formatGhs(payment.amount)}</p>
                  </div>
                ))
              )}
            </Card>
          </div>
        );
      }}
    </AdminState>
  );
}

export function AdminReports() {
  return (
    <AdminState>
      {(data) => {
        const paid = data.payments.filter((payment) => payment.status === 'paid');
        const averagePayment = paid.length
          ? paid.reduce((sum, payment) => sum + payment.amount, 0) / paid.length
          : 0;
        return (
          <div className="space-y-5 pb-4">
            <PageHeader
              title="Reports"
              description="Current operational and financial snapshot."
              action={
                <Button variant="outline" size="md">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              }
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryCard icon={<Users />} label="Customers" value={String(data.kpis.customers)} />
              <SummaryCard icon={<Wrench />} label="Mechanics" value={String(data.kpis.mechanics)} />
              <SummaryCard icon={<BarChart3 />} label="Revenue" value={formatGhs(data.kpis.revenueGhs)} />
              <SummaryCard icon={<CreditCard />} label="Avg. payment" value={formatGhs(averagePayment)} />
            </div>
            <Card>
              <div className="p-5">
                <h3 className="font-display font-bold">Service catalogue</h3>
                <p className="mt-1 text-sm text-muted-foreground">Active services and current estimates.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.serviceTypes.map((service) => (
                    <div key={service._id} className="rounded-xl border border-border p-3">
                      <p className="font-semibold">{service.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
                      <p className="mt-2 font-bold">{formatGhs(service.estimatedPrice)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        );
      }}
    </AdminState>
  );
}

export function AdminSettings({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAuth();
  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Settings" description="Administration account and platform configuration." />
      <Card>
        <div className="flex items-center gap-4 p-5">
          <Avatar
            fallback={mechanicInitials(`${user?.firstName ?? 'A'} ${user?.lastName ?? 'D'}`)}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Badge variant="success">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administrator
          </Badge>
        </div>
      </Card>
      <Card>
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-semibold">Platform settings</p>
              <p className="text-sm text-muted-foreground">
                Service pricing is currently managed through seeded catalogue data.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <div className="p-4">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
