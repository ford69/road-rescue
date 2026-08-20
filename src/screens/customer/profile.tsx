import * as React from 'react';
import {
  Car,
  Star,
  Shield,
  HelpCircle,
  ChevronRight,
  LogOut,
  Plus,
  Settings,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatGhs } from '@/lib/currency';
import { useAuth } from '@/context/auth-context';
import { useRequests, useVehicles } from '@/hooks/useApi';
import { vehiclesApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';

const emptyVehicleForm = {
  nickname: '',
  make: '',
  model: '',
  colour: '',
  registrationNumber: '',
  year: String(new Date().getFullYear()),
  engineType: 'petrol',
};

export function Profile({
  onThemeToggle,
  onSignOut,
}: {
  onThemeToggle?: () => void;
  onSignOut?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: vehicles, loading: vehiclesLoading, error: vehiclesError, reload: reloadVehicles } =
    useVehicles(user?.role === 'customer');
  const { data: requests } = useRequests();
  const [showVehicleForm, setShowVehicleForm] = React.useState(false);
  const [vehicleForm, setVehicleForm] = React.useState(emptyVehicleForm);
  const [addingVehicle, setAddingVehicle] = React.useState(false);
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Road Rescue User';
  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : 'RR';
  const roleLabel =
    user?.role === 'mechanic' ? 'Verified Mechanic' : user?.role === 'admin' ? 'Administrator' : 'Premium Member';
  const completedCount = requests.filter((r) => r.status === 'completed').length;
  const totalSpent = requests
    .filter((r) => r.status === 'completed' || r.paymentStatus === 'paid')
    .reduce((sum, r) => sum + r.quotedPrice, 0);

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
      {/* Profile header */}
      <Card className="overflow-hidden border-0">
        <div className="h-24 bg-gradient-to-br from-foreground to-foreground/80 dark:from-zinc-800 dark:to-zinc-900" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex items-end gap-4">
            <Avatar
              fallback={initials}
              size="xl"
              className="ring-4 ring-card"
            />
            <div className="pb-1">
              <h2 className="font-display text-xl font-bold tracking-tight">
                {fullName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="primary">
                  <Star className="h-3 w-3 fill-current" />
                  {roleLabel}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {user?.phone ?? '+233'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="p-4 text-center">
            <p className="font-display text-2xl font-bold">{completedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Services</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="font-display text-2xl font-bold">{vehicles.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Vehicles</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="font-display text-2xl font-bold">{formatGhs(totalSpent)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Spent</p>
          </div>
        </Card>
      </div>

      {/* Vehicles */}
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

      {/* Settings menu */}
      <div>
        <h3 className="font-display text-base font-bold mb-3 px-1">Account</h3>
        <Card className="overflow-hidden divide-y divide-border">
          <SettingRow icon={<Shield className="h-5 w-5" />} label="Privacy & Security" />
          <SettingRow icon={<HelpCircle className="h-5 w-5" />} label="Help & Support" />
          <SettingRow icon={<Settings className="h-5 w-5" />} label="Settings" onClick={onThemeToggle} />
        </Card>
      </div>

      <Button variant="outline" fullWidth size="lg" onClick={onSignOut}>
        <LogOut className="h-5 w-5" />
        Sign Out
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Road Rescue Ghana v1.0.0 · ₵ Cedis
      </p>
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
      onClick={onClick}
      className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent transition-colors"
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
