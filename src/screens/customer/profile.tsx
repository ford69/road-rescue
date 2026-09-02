import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car,
  Star,
  Shield,
  HelpCircle,
  ChevronRight,
  LogOut,
  Plus,
  Settings,
  User,
  Wrench,
  CreditCard,
  DollarSign,
  Moon,
  Sun,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetBody, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { formatGhs } from '@/lib/currency';
import { getUserInitials, resolveMediaUrl } from '@/lib/user-display';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/components/theme-provider';
import { useRequests, useVehicles } from '@/hooks/useApi';
import { mechanicsApi, subscriptionsApi, vehiclesApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';
import { SubscriptionPlanPicker } from '@/components/subscriptions/plan-picker';
import type { MechanicDto, ProviderPayoutInfoDto } from '@/api/types';
import { serviceTypeConfig } from '@/lib/service-config';

const emptyVehicleForm = {
  nickname: '',
  make: '',
  model: '',
  colour: '',
  registrationNumber: '',
  year: String(new Date().getFullYear()),
  engineType: 'petrol',
};

type ProfilePanel = 'personal' | 'service' | 'settings' | 'privacy' | null;

export function Profile({
  onSignOut,
}: {
  onThemeToggle?: () => void;
  onSignOut?: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { data: vehicles, loading: vehiclesLoading, error: vehiclesError, reload: reloadVehicles } =
    useVehicles(user?.role === 'customer');
  const { data: requests } = useRequests();
  const [showVehicleForm, setShowVehicleForm] = React.useState(false);
  const [vehicleForm, setVehicleForm] = React.useState(emptyVehicleForm);
  const [addingVehicle, setAddingVehicle] = React.useState(false);
  const [payoutInfo, setPayoutInfo] = React.useState<ProviderPayoutInfoDto | null>(null);
  const [mechanicProfile, setMechanicProfile] = React.useState<MechanicDto | null>(null);
  const [membershipLabel, setMembershipLabel] = React.useState('Member');
  const [activePanel, setActivePanel] = React.useState<ProfilePanel>(null);
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Road Rescue User';
  const initials = getUserInitials(user);
  const avatarSrc = resolveMediaUrl(user?.avatar);
  const roleLabel =
    user?.role === 'mechanic'
      ? 'Verified Provider'
      : user?.role === 'admin'
        ? 'Administrator'
        : membershipLabel;
  const completedCount = requests.filter((r) => r.status === 'completed').length;
  const totalSpent = requests
    .filter((r) => r.status === 'completed' || r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + r.quotedPrice, 0);

  React.useEffect(() => {
    if (user?.role !== 'mechanic') return;
    void mechanicsApi.payoutInfo().then(setPayoutInfo).catch(() => undefined);
    void mechanicsApi.profile().then(setMechanicProfile).catch(() => undefined);
  }, [user?.role]);

  React.useEffect(() => {
    if (user?.role !== 'customer') return;
    void subscriptionsApi
      .current()
      .then((summary) => setMembershipLabel(summary.plan?.name ?? 'Free Member'))
      .catch(() => undefined);
  }, [user?.role]);

  const updateVehicleField = (field: keyof typeof vehicleForm, value: string) => {
    setVehicleForm((current) => ({ ...current, [field]: value }));
  };

  const addVehicle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const year = Number(vehicleForm.year);
    if (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1) {
      toast({
        type: 'error',
        title: 'Invalid vehicle year',
        description: `Enter a year from 1980 to ${new Date().getFullYear() + 1}.`,
      });
      return;
    }

    setAddingVehicle(true);
    try {
      await vehiclesApi.create({
        make: vehicleForm.make.trim(),
        model: vehicleForm.model.trim(),
        colour: vehicleForm.colour.trim(),
        registrationNumber: vehicleForm.registrationNumber.trim().toUpperCase(),
        year,
        engineType: vehicleForm.engineType,
        nickname: vehicleForm.nickname.trim() || undefined,
      });
      await reloadVehicles();
      setVehicleForm(emptyVehicleForm);
      setShowVehicleForm(false);
      toast({
        type: 'success',
        title: 'Vehicle added',
        description: 'Your vehicle is ready for rescue requests.',
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not add vehicle',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setAddingVehicle(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <Card className="overflow-hidden border-0">
        <div className="h-24 bg-gradient-to-br from-foreground to-foreground/80 dark:from-zinc-800 dark:to-zinc-900" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <Avatar
              src={avatarSrc}
              alt={fullName}
              fallback={initials}
              size="xl"
              className="ring-4 ring-card"
            />
            <div className="pb-1">
              <h2 className="font-display text-xl font-bold tracking-tight">{fullName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="primary">
                  <Star className="h-3 w-3 fill-current" />
                  {roleLabel}
                </Badge>
                <span className="text-sm text-muted-foreground">{user?.phone ?? '+233'}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="p-4 text-center">
            <p className="font-display text-2xl font-bold">{completedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Services</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="font-display text-2xl font-bold">
              {user?.role === 'mechanic' ? mechanicProfile?.completedJobs ?? 0 : vehicles.length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user?.role === 'mechanic' ? 'Jobs' : 'Vehicles'}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="font-display text-2xl font-bold">
              {user?.role === 'mechanic'
                ? `⭐ ${(mechanicProfile?.rating ?? 0).toFixed(1)}`
                : formatGhs(totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user?.role === 'mechanic' ? 'Rating' : 'Spent'}
            </p>
          </div>
        </Card>
      </div>

      {user?.role === 'customer' && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-display text-base font-bold">My Vehicles</h3>
            <button
              type="button"
              onClick={() => setShowVehicleForm((current) => !current)}
              className="flex items-center gap-1 text-sm font-semibold text-primary"
              aria-expanded={showVehicleForm}
            >
              <Plus className="h-4 w-4" />
              {showVehicleForm ? 'Cancel' : 'Add'}
            </button>
          </div>

          {showVehicleForm && (
            <Card className="mb-3">
              <form className="space-y-3 p-4" onSubmit={addVehicle}>
                <div>
                  <h4 className="font-semibold">Add a vehicle</h4>
                  <p className="text-xs text-muted-foreground">
                    Enter the details shown on the vehicle registration.
                  </p>
                </div>
                <Input
                  value={vehicleForm.nickname}
                  onChange={(event) => updateVehicleField('nickname', event.target.value)}
                  placeholder="Nickname (optional)"
                  maxLength={50}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={vehicleForm.make}
                    onChange={(event) => updateVehicleField('make', event.target.value)}
                    placeholder="Make, e.g. Toyota"
                    required
                  />
                  <Input
                    value={vehicleForm.model}
                    onChange={(event) => updateVehicleField('model', event.target.value)}
                    placeholder="Model, e.g. Corolla"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={vehicleForm.colour}
                    onChange={(event) => updateVehicleField('colour', event.target.value)}
                    placeholder="Colour"
                    required
                  />
                  <Input
                    value={vehicleForm.registrationNumber}
                    onChange={(event) =>
                      updateVehicleField('registrationNumber', event.target.value.toUpperCase())
                    }
                    placeholder="GR-2345-21"
                    required
                    minLength={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    value={vehicleForm.year}
                    onChange={(event) => updateVehicleField('year', event.target.value)}
                    placeholder="Year"
                    min={1980}
                    max={new Date().getFullYear() + 1}
                    required
                  />
                  <select
                    value={vehicleForm.engineType}
                    onChange={(event) => updateVehicleField('engineType', event.target.value)}
                    className="h-12 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Engine type"
                  >
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
                <Button type="submit" fullWidth disabled={addingVehicle}>
                  {addingVehicle ? 'Adding vehicle…' : 'Save vehicle'}
                </Button>
              </form>
            </Card>
          )}

          <div className="space-y-2">
            {vehiclesLoading && (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading vehicles…</p>
            )}
            {!vehiclesLoading && vehiclesError && (
              <Card>
                <p className="p-4 text-sm text-critical">{vehiclesError}</p>
              </Card>
            )}
            {!vehiclesLoading && !vehiclesError && vehicles.length === 0 && (
              <Card>
                <div className="p-5 text-center">
                  <Car className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 font-semibold">No vehicles added</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your first vehicle to request roadside assistance.
                  </p>
                </div>
              </Card>
            )}
            {vehicles.map((v) => (
              <Card key={v._id} interactive>
                <div className="p-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <Car className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {v.nickname ?? `${v.make} ${v.vehicleModel}`}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {v.year} {v.make} {v.vehicleModel} · {v.registrationNumber}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {user?.role === 'customer' && <SubscriptionPlanPicker />}

      <div>
        <h3 className="font-display text-base font-bold mb-3 px-1">Account</h3>
        <Card className="overflow-hidden divide-y divide-border">
          {user?.role === 'mechanic' ? (
            <>
              <SettingRow
                icon={<User className="h-5 w-5" />}
                label="Personal information"
                onClick={() => setActivePanel('personal')}
              />
              <SettingRow
                icon={<Wrench className="h-5 w-5" />}
                label="Service information"
                onClick={() => setActivePanel('service')}
              />
              <SettingRow
                icon={<CreditCard className="h-5 w-5" />}
                label="Payment information"
                value={payoutInfo?.configured ? 'Configured' : 'Pending'}
                onClick={() => {
                  if (payoutInfo?.managementUrl) {
                    window.open(payoutInfo.managementUrl, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  toast({
                    type: 'info',
                    title: 'Payment account',
                    description:
                      payoutInfo?.message ??
                      'Your payments are settled through our payment provider. Payout management will be available once your payment account is configured.',
                  });
                }}
              />
              <SettingRow
                icon={<DollarSign className="h-5 w-5" />}
                label="Earnings & payments"
                onClick={() => navigate('/mechanic/earnings')}
              />
              <SettingRow
                icon={<HelpCircle className="h-5 w-5" />}
                label="Help & support"
                onClick={() => navigate('/mechanic/support')}
              />
              <SettingRow
                icon={<Shield className="h-5 w-5" />}
                label="Privacy & Security"
                onClick={() => setActivePanel('privacy')}
              />
              <SettingRow
                icon={<Settings className="h-5 w-5" />}
                label="Settings"
                onClick={() => setActivePanel('settings')}
              />
            </>
          ) : (
            <>
              <SettingRow
                icon={<User className="h-5 w-5" />}
                label="Personal information"
                onClick={() => setActivePanel('personal')}
              />
              <SettingRow
                icon={<Shield className="h-5 w-5" />}
                label="Privacy & Security"
                onClick={() => setActivePanel('privacy')}
              />
              <SettingRow
                icon={<HelpCircle className="h-5 w-5" />}
                label="Help & Support"
                onClick={() => navigate('/customer/support')}
              />
              <SettingRow
                icon={<Settings className="h-5 w-5" />}
                label="Settings"
                onClick={() => setActivePanel('settings')}
              />
            </>
          )}
        </Card>
      </div>

      <Button variant="outline" fullWidth size="lg" onClick={onSignOut}>
        <LogOut className="h-5 w-5" />
        Sign Out
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Road Rescue Ghana v1.0.0 · ₵ Cedis
      </p>

      <Sheet open={activePanel !== null} onOpenChange={(open) => !open && setActivePanel(null)}>
        <SheetContent side="bottom">
          <SheetHeader
            title={
              activePanel === 'personal'
                ? 'Personal information'
                : activePanel === 'service'
                  ? 'Service information'
                  : activePanel === 'privacy'
                    ? 'Privacy & Security'
                    : 'Settings'
            }
            onClose={() => setActivePanel(null)}
          />
          <SheetBody>
            {activePanel === 'personal' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar src={avatarSrc} alt={fullName} fallback={initials} size="lg" />
                  <div>
                    <p className="font-semibold">{fullName}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <InfoRow label="First name" value={user?.firstName} />
                <InfoRow label="Last name" value={user?.lastName} />
                <InfoRow label="Email" value={user?.email} />
                <InfoRow label="Phone" value={user?.phone} />
                <InfoRow label="Account status" value={user?.status} />
              </div>
            )}

            {activePanel === 'service' && (
              <div className="space-y-4">
                {!mechanicProfile ? (
                  <p className="text-sm text-muted-foreground">Loading service profile…</p>
                ) : (
                  <>
                    <InfoRow label="Garage" value={mechanicProfile.garageName} />
                    <InfoRow
                      label="Verification"
                      value={mechanicProfile.verificationStatus ?? 'unverified'}
                    />
                    <InfoRow
                      label="Experience"
                      value={
                        mechanicProfile.experience != null
                          ? `${mechanicProfile.experience} years`
                          : 'Not set'
                      }
                    />
                    <InfoRow label="Truck / vehicle" value={mechanicProfile.truck ?? 'Not set'} />
                    <InfoRow label="City" value={mechanicProfile.location?.city} />
                    <InfoRow label="Address" value={mechanicProfile.location?.address} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Specialties
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(mechanicProfile.specialties ?? []).length === 0 ? (
                          <span className="text-sm text-muted-foreground">None listed</span>
                        ) : (
                          mechanicProfile.specialties.map((slug) => (
                            <Badge key={slug} variant="outline">
                              {serviceTypeConfig[slug]?.label ?? slug}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activePanel === 'settings' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? (
                      <Moon className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Sun className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-semibold text-sm">Appearance</p>
                      <p className="text-xs text-muted-foreground">Currently using {theme} mode</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary">Toggle</span>
                </button>
              </div>
            )}

            {activePanel === 'privacy' && (
              <div className="space-y-4">
                <InfoRow
                  label="Email verification"
                  value={user?.emailVerified ? 'Verified' : 'Not verified'}
                />
                <InfoRow label="Account status" value={user?.status} />
                <InfoRow label="Signed in as" value={user?.email} />
                <div className="rounded-xl border border-border px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Password
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reset your password securely through the forgot password flow.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setActivePanel(null);
                      navigate('/auth/forgot-password');
                    }}
                  >
                    Change password
                  </Button>
                </div>
                <div className="rounded-xl border border-border px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Data & privacy
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Road Rescue uses your profile and location details only to match you with help
                    and manage your account. For privacy questions, email support@roadrescue4u.com.
                  </p>
                </div>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || '—'}</p>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent transition-colors disabled:cursor-default disabled:hover:bg-transparent"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-muted-foreground">
        {icon}
      </div>
      <span className="flex-1 font-semibold text-sm">{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}
