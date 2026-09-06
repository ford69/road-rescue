import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Truck,
  BatteryCharging,
  CircleDot,
  KeyRound,
  Fuel,
  AlertTriangle,
  Wrench,
  MapPin,
  Check,
  ChevronRight,
  ChevronLeft,
  Navigation2,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/input';
import { MapView } from '@/components/map-view';
import { EmptyState } from '@/components/empty-state';
import { formatGhs } from '@/lib/currency';
import { serviceTypeConfig } from '@/lib/service-config';
import {
  DEFAULT_PICKUP_LOCATION,
  GHANA_PICKUP_LOCATIONS,
  type GhanaLocation,
} from '@/lib/locations';
import { useServiceTypes, useVehicles, useSubscription } from '@/hooks/useApi';
import { requestsApi } from '@/api/repositories';
import type { RescueRequestDto, ServiceType, VehicleDto } from '@/api/types';
import { ApiClientError } from '@/api/client/http';
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

type Step = 'location' | 'vehicle' | 'problem' | 'estimate' | 'confirm' | 'submitted';

const steps: { id: Step; label: string }[] = [
  { id: 'location', label: 'Location' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'problem', label: 'Problem' },
  { id: 'estimate', label: 'Estimate' },
  { id: 'confirm', label: 'Confirm' },
];

const serviceTypes = Object.keys(serviceTypeConfig) as ServiceType[];

function isServiceType(value: string | null): value is ServiceType {
  return Boolean(value && serviceTypes.includes(value as ServiceType));
}

export function RequestFlow({
  onComplete,
  onCancel,
}: {
  onComplete: (request: RescueRequestDto) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { data: vehicles, loading: vehiclesLoading } = useVehicles();
  const { data: catalog } = useServiceTypes();
  const { data: membership } = useSubscription();
  const restricted = React.useMemo(
    () => new Set(membership?.restrictedServiceTypes ?? ['towing', 'fuel', 'accident']),
    [membership],
  );
  const [step, setStep] = React.useState<Step>('location');
  const [pickup, setPickup] = React.useState<GhanaLocation>(DEFAULT_PICKUP_LOCATION);
  const [selectedVehicle, setSelectedVehicle] = React.useState<VehicleDto | null>(null);
  const [selectedService, setSelectedService] = React.useState<ServiceType | null>(null);
  const [description, setDescription] = React.useState('');
  const [createdRequest, setCreatedRequest] = React.useState<RescueRequestDto | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const stepIndex = steps.findIndex((s) => s.id === step);
  const isFlowStep = stepIndex >= 0;
  const catalogPrices = Object.fromEntries(
    catalog.map((service) => [service.slug, service.estimatedPrice]),
  ) as Partial<Record<ServiceType, number>>;

  React.useEffect(() => {
    const serviceParam = searchParams.get('service');
    if (isServiceType(serviceParam) && !restricted.has(serviceParam)) {
      setSelectedService(serviceParam);
    }
  }, [restricted, searchParams]);

  React.useEffect(() => {
    if (vehicles.length && !selectedVehicle) {
      setSelectedVehicle(vehicles[0]);
    }
  }, [vehicles, selectedVehicle]);

  const goNext = () => {
    const order: Step[] = ['location', 'vehicle', 'problem', 'estimate', 'confirm'];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };

  const goBack = () => {
    const order: Step[] = ['location', 'vehicle', 'problem', 'estimate', 'confirm'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
    else onCancel();
  };

  const submitRequest = async () => {
    if (!selectedVehicle || !selectedService) return;
    setSubmitting(true);
    try {
      const request = await requestsApi.create({
        vehicleId: selectedVehicle._id,
        serviceType: selectedService,
        pickupAddress: pickup.address,
        pickupCity: pickup.city,
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        description:
          description.trim() ||
          `${serviceTypeConfig[selectedService].label} requested near ${pickup.address}, ${pickup.city}`,
      });
      setCreatedRequest(request);
      setStep('submitted');
    } catch (err) {
      toast({
        type: 'error',
        title: 'Request failed',
        description: err instanceof ApiClientError ? err.message : 'Could not create rescue request',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSubmittedRequest = async () => {
    if (!createdRequest) {
      onCancel();
      return;
    }
    setCancelling(true);
    try {
      await requestsApi.updateStatus(createdRequest._id, 'cancelled');
      toast({
        type: 'success',
        title: 'Request cancelled',
        description: 'Your rescue request has been cancelled.',
      });
      onCancel();
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

  if (step === 'submitted' && createdRequest) {
    return (
      <SubmittedScreen
        request={createdRequest}
        pickup={pickup}
        cancelling={cancelling}
        onTrack={() => onComplete(createdRequest)}
        onCancel={() => void cancelSubmittedRequest()}
      />
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {isFlowStep && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-sm font-semibold text-muted-foreground">
              Step {stepIndex + 1} of {steps.length}
            </span>
          </div>
          <Progress value={((stepIndex + 1) / steps.length) * 100} size="sm" />
        </div>
      )}

      {step === 'location' && (
        <LocationStep pickup={pickup} onSelect={setPickup} goNext={goNext} />
      )}
      {step === 'vehicle' && (
        <VehicleStep
          vehicles={vehicles}
          loading={vehiclesLoading}
          selectedVehicle={selectedVehicle}
          onSelect={setSelectedVehicle}
          goNext={goNext}
        />
      )}
      {step === 'problem' && (
        <ProblemStep
          catalogPrices={catalogPrices}
          selectedService={selectedService}
          description={description}
          restricted={restricted}
          onSelect={setSelectedService}
          onDescriptionChange={setDescription}
          goNext={goNext}
        />
      )}
      {step === 'estimate' && (
        <EstimateStep
          vehicle={selectedVehicle}
          service={selectedService}
          price={selectedService ? catalogPrices[selectedService] : undefined}
          goNext={goNext}
        />
      )}
      {step === 'confirm' && (
        <ConfirmStep
          pickup={pickup}
          vehicle={selectedVehicle}
          service={selectedService}
          description={description}
          price={selectedService ? catalogPrices[selectedService] : undefined}
          submitting={submitting}
          onConfirm={() => void submitRequest()}
        />
      )}
    </div>
  );
}

function LocationStep({
  pickup,
  onSelect,
  goNext,
}: {
  pickup: GhanaLocation;
  onSelect: (location: GhanaLocation) => void;
  goNext: () => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Confirm your location</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose where help should meet you in Ghana.
        </p>
      </div>

      <MapView
        className="h-56 min-h-[14rem] w-full rounded-2xl border border-border sm:h-64 landscape:h-[38dvh] landscape:min-h-[12rem]"
        markers={[
          {
            id: 'user',
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            type: 'user',
            label: 'Pickup',
          },
        ]}
      />

      <div className="space-y-2">
        {GHANA_PICKUP_LOCATIONS.map((location) => {
          const selected = pickup.id === location.id;
          return (
            <Card
              key={location.id}
              interactive
              onClick={() => onSelect(location)}
              className={cn(selected && 'border-primary ring-2 ring-primary/20')}
            >
              <div className="p-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-foreground">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{location.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {location.address}, {location.city}
                  </p>
                </div>
                {selected && (
                  <Badge variant="success" dot>
                    Selected
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Button fullWidth size="lg" onClick={goNext}>
        Confirm Location
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

function VehicleStep({
  vehicles,
  loading,
  selectedVehicle,
  onSelect,
  goNext,
}: {
  vehicles: VehicleDto[];
  loading: boolean;
  selectedVehicle: VehicleDto | null;
  onSelect: (v: VehicleDto) => void;
  goNext: () => void;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading vehicles…</p>;
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={<Truck className="h-10 w-10" />}
        title="No vehicles found"
        description="Add a vehicle from your profile before requesting assistance."
        action={
          <Link
            to="/customer/profile"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Add vehicle
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Which vehicle needs help?</h2>
        <p className="text-sm text-muted-foreground mt-1">Select the vehicle in trouble.</p>
      </div>

      <div className="space-y-2">
        {vehicles.map((v) => {
          const selected = selectedVehicle?._id === v._id;
          return (
            <Card
              key={v._id}
              interactive
              onClick={() => onSelect(v)}
              className={cn(selected && 'border-primary ring-2 ring-primary/20')}
            >
              <div className="p-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent">
                  <Truck className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">
                    {v.year} {v.make} {v.vehicleModel}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {v.colour} · {v.registrationNumber}
                  </p>
                </div>
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {selected && <Check className="h-4 w-4" />}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Button fullWidth size="lg" disabled={!selectedVehicle} onClick={goNext}>
        Continue
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

function ProblemStep({
  catalogPrices,
  selectedService,
  description,
  restricted,
  onSelect,
  onDescriptionChange,
  goNext,
}: {
  catalogPrices: Partial<Record<ServiceType, number>>;
  selectedService: ServiceType | null;
  description: string;
  restricted: Set<string>;
  onSelect: (s: ServiceType) => void;
  onDescriptionChange: (value: string) => void;
  goNext: () => void;
}) {
  const services = Object.entries(serviceTypeConfig) as [
    ServiceType,
    (typeof serviceTypeConfig)[ServiceType],
  ][];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">What's the problem?</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose the service you need.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {services.map(([type, config]) => {
          const Icon = iconMap[config.icon] ?? Wrench;
          const selected = selectedService === type;
          const price = catalogPrices[type] ?? config.basePrice;
          const locked = restricted.has(type);
          return (
            <button
              key={type}
              onClick={() => !locked && onSelect(type)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.98]',
                locked
                  ? 'border-border bg-muted/40 opacity-80'
                  : selected
                    ? 'border-primary bg-primary-50/50 dark:bg-primary-900/20'
                    : 'border-border bg-card hover:border-primary-200',
              )}
            >
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                  selected ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{config.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{config.description}</p>
              </div>
              <p className="text-xs font-bold text-primary mt-1">from {formatGhs(price)}</p>
              {locked && (
                <p className="text-xs font-semibold text-muted-foreground">
                  {config.label} is not included in your Basic plan. Upgrade to Premium to access this service.
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold" htmlFor="rescue-description">
          Extra details (optional)
        </label>
        <Textarea
          id="rescue-description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Example: Car will not start after shopping near Spintex Road."
          maxLength={400}
        />
      </div>

      <Button fullWidth size="lg" disabled={!selectedService} onClick={goNext}>
        Continue
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

function EstimateStep({
  vehicle,
  service,
  price,
  goNext,
}: {
  vehicle: VehicleDto | null;
  service: ServiceType | null;
  price?: number;
  goNext: () => void;
}) {
  if (!vehicle || !service) return null;
  const config = serviceTypeConfig[service];
  const Icon = iconMap[config.icon] ?? Wrench;
  const estimate = price ?? config.basePrice;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Estimated cost</h2>
        <p className="text-sm text-muted-foreground mt-1">Prices shown in Ghana Cedis (₵).</p>
      </div>

      <Card>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{config.label}</p>
              <p className="text-sm text-muted-foreground">
                {vehicle.year} {vehicle.make} {vehicle.vehicleModel}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-accent p-4 flex items-center justify-between">
            <span className="text-sm font-medium">Estimated total</span>
            <span className="font-display text-2xl font-bold">{formatGhs(estimate)}</span>
          </div>
        </div>
      </Card>

      <Button fullWidth size="lg" onClick={goNext}>
        Continue
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

function ConfirmStep({
  pickup,
  vehicle,
  service,
  description,
  price,
  submitting,
  onConfirm,
}: {
  pickup: GhanaLocation;
  vehicle: VehicleDto | null;
  service: ServiceType | null;
  description: string;
  price?: number;
  submitting: boolean;
  onConfirm: () => void;
}) {
  if (!vehicle || !service) return null;
  const config = serviceTypeConfig[service];
  const estimate = price ?? config.basePrice;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">Confirm request</h2>
        <p className="text-sm text-muted-foreground mt-1">We'll notify nearby Ghana mechanics.</p>
      </div>

      <Card>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Location</span>
            <span className="font-semibold text-right">
              {pickup.address}, {pickup.city}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Vehicle</span>
            <span className="font-semibold text-right">
              {vehicle.year} {vehicle.make} {vehicle.vehicleModel}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Service</span>
            <span className="font-semibold text-right">{config.label}</span>
          </div>
          {description.trim() && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Details</span>
              <span className="font-semibold text-right max-w-[60%]">{description.trim()}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Estimate</span>
            <span className="font-semibold text-right">{formatGhs(estimate)}</span>
          </div>
        </div>
      </Card>

      <Button fullWidth size="lg" onClick={onConfirm} disabled={submitting}>
        <ShieldAlert className="h-5 w-5" />
        {submitting ? 'Submitting…' : 'Request Assistance'}
      </Button>
    </div>
  );
}

function SubmittedScreen({
  request,
  pickup,
  cancelling,
  onTrack,
  onCancel,
}: {
  request: RescueRequestDto;
  pickup: GhanaLocation;
  cancelling: boolean;
  onTrack: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 animate-fade-in-up pb-4">
      <div className="text-center space-y-2">
        <div className="relative mx-auto w-fit">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Navigation2 className="h-8 w-8" />
          </div>
          <span className="absolute -inset-2 rounded-full border-2 border-primary animate-pulse-ring" />
        </div>
        <h2 className="font-display text-2xl font-bold">Request submitted</h2>
        <p className="text-sm text-muted-foreground">
          Your {serviceTypeConfig[request.serviceType].label.toLowerCase()} request is live near{' '}
          {pickup.address}. Nearby mechanics can accept it now.
        </p>
      </div>

      <Card>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="primary" dot>
              Waiting for mechanic
            </Badge>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Location</span>
            <span className="font-semibold text-right">
              {request.pickupLocation.address}, {request.pickupLocation.city}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Service</span>
            <span className="font-semibold text-right">
              {serviceTypeConfig[request.serviceType].label}
            </span>
          </div>
        </div>
      </Card>

      <Button fullWidth size="lg" onClick={onTrack}>
        Track Request
      </Button>
      <Button fullWidth variant="outline" onClick={onCancel} disabled={cancelling}>
        {cancelling ? 'Cancelling…' : 'Cancel request'}
      </Button>
    </div>
  );
}
