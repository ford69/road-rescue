import * as React from 'react';
import { Search, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/ui/input';
import { Sheet, SheetBody, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { providerServicesApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { formatGhs } from '@/lib/currency';
import { formatPricingLabel, pricingModelLabel } from '@/lib/pricing';
import { useToast } from '@/components/ui/toast';
import type {
  AdditionalChargeKind,
  PricingModel,
  ProviderServiceOfferingDto,
  ProviderServicesBoardDto,
} from '@/api/types';

type CatalogueService = ProviderServicesBoardDto['categories'][number]['services'][number];

const MODEL_OPTIONS: Array<{ id: PricingModel; label: string; hint: string }> = [
  { id: 'fixed', label: 'Fixed price', hint: 'Customer sees this exact amount.' },
  { id: 'starting_from', label: 'Starting from', hint: 'Final amount needs customer confirmation.' },
  { id: 'quote', label: 'Request a quote', hint: 'You send a quote after reviewing the job.' },
];

export function MechanicServicesPage() {
  const { toast } = useToast();
  const [board, setBoard] = React.useState<ProviderServicesBoardDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [editing, setEditing] = React.useState<CatalogueService | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    pricingModel: 'fixed' as PricingModel,
    basePriceGhs: '100',
    partsNotIncluded: false,
    chargeKind: 'call_out' as AdditionalChargeKind,
    chargeAmount: '',
    chargePerKm: '',
    charges: [] as Array<{
      kind: AdditionalChargeKind;
      label: string;
      amountGhs?: number;
      perKmGhs?: number;
      commissionable: boolean;
    }>,
  });

  const load = React.useCallback(async () => {
    const next = await providerServicesApi.board();
    setBoard(next);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (error) {
        if (!cancelled) {
          toast({
            type: 'error',
            title: 'Could not load services',
            description: error instanceof ApiClientError ? error.message : 'Please try again.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, toast]);

  const openEditor = (service: CatalogueService) => {
    const offering = service.offering;
    setEditing(service);
    setForm({
      pricingModel: offering?.pricingModel ?? 'fixed',
      basePriceGhs: offering?.basePriceGhs != null ? String(offering.basePriceGhs) : '100',
      partsNotIncluded: offering?.partsNotIncluded ?? false,
      chargeKind: 'call_out',
      chargeAmount: '',
      chargePerKm: '',
      charges: (offering?.additionalCharges ?? []).map((charge) => ({
        kind: charge.kind,
        label: charge.label,
        amountGhs: charge.amountGhs,
        perKmGhs: charge.perKmGhs,
        commissionable: charge.commissionable,
      })),
    });
  };

  const save = async () => {
    if (!editing || !board) return;
    const amount = Number(form.basePriceGhs);
    if (form.pricingModel !== 'quote' && (!Number.isFinite(amount) || amount < board.minPriceGhs)) {
      toast({
        type: 'error',
        title: 'Enter a valid price',
        description: `Minimum is ${formatGhs(board.minPriceGhs)}.`,
      });
      return;
    }
    setBusy(true);
    try {
      await providerServicesApi.upsert({
        serviceType: editing.slug,
        pricingModel: form.pricingModel,
        basePriceGhs: form.pricingModel === 'quote' ? undefined : amount,
        additionalCharges: form.charges,
        partsNotIncluded: form.partsNotIncluded,
        active: true,
      });
      await load();
      setEditing(null);
      toast({ type: 'success', title: 'Service pricing saved' });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not save',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (offering: ProviderServiceOfferingDto) => {
    setBusy(true);
    try {
      await providerServicesApi.setStatus(offering.serviceType, !offering.active);
      await load();
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not update status',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (offering: ProviderServiceOfferingDto) => {
    if (!window.confirm(`Remove ${offering.serviceType} from your active services? Past jobs stay on record.`)) {
      return;
    }
    setBusy(true);
    try {
      await providerServicesApi.remove(offering.serviceType);
      await load();
      toast({ type: 'success', title: 'Service removed from your active list' });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Could not remove service',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading services…</p>;
  }
  if (!board) {
    return (
      <EmptyState
        icon={<Wrench className="h-10 w-10" />}
        title="Services unavailable"
        description="Sign in as a provider to manage the services you offer."
      />
    );
  }

  const needle = query.trim().toLowerCase();
  const categories = board.categories
    .map((category) => ({
      ...category,
      services: category.services.filter(
        (service) =>
          !needle ||
          service.name.toLowerCase().includes(needle) ||
          service.description.toLowerCase().includes(needle),
      ),
    }))
    .filter((category) => category.services.length > 0);

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Services & Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the Road Rescue services you offer and set your own Ghana Cedis prices.
        </p>
      </div>

      <Input
        icon={<Search className="h-4 w-4" />}
        placeholder="Search the catalogue"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search services"
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-10 w-10" />}
          title="No matching services"
          description="Try another search, or clear the filter to see the full catalogue."
        />
      ) : (
        categories.map((category) => (
          <div key={category.id} className="space-y-3">
            <h2 className="font-display text-lg font-bold">{category.name}</h2>
            {category.services.map((service) => (
              <ServiceRow
                key={service.slug}
                service={service}
                busy={busy}
                onEdit={() => openEditor(service)}
                onToggle={service.offering ? () => void toggle(service.offering!) : undefined}
                onRemove={service.offering ? () => void remove(service.offering!) : undefined}
              />
            ))}
          </div>
        ))
      )}

      <Sheet open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent>
          <SheetHeader
            title={editing?.name ?? 'Service pricing'}
            onClose={() => setEditing(null)}
          />
          <SheetBody>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{editing?.description}</p>
              <div className="space-y-2">
                {MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`w-full rounded-xl border p-3 text-left ${
                      form.pricingModel === option.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                    onClick={() => setForm((current) => ({ ...current, pricingModel: option.id }))}
                  >
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.hint}</p>
                  </button>
                ))}
              </div>
              {form.pricingModel !== 'quote' && (
                <Input
                  type="number"
                  min={board.minPriceGhs}
                  value={form.basePriceGhs}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, basePriceGhs: event.target.value }))
                  }
                  aria-label="Price in GHS"
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.partsNotIncluded}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      partsNotIncluded: event.target.checked,
                    }))
                  }
                />
                Parts and materials are charged separately
              </label>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Additional charges</p>
                {form.charges.map((charge, index) => (
                  <div key={`${charge.kind}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {charge.label}
                      {charge.kind === 'distance'
                        ? ` · ${formatGhs(charge.perKmGhs ?? 0, 2)}/km`
                        : ` · ${formatGhs(charge.amountGhs ?? 0, 2)}`}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          charges: current.charges.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <select
                  className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-sm"
                  value={form.chargeKind}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      chargeKind: event.target.value as AdditionalChargeKind,
                    }))
                  }
                >
                  {board.chargeKinds.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.label}
                    </option>
                  ))}
                </select>
                {form.chargeKind === 'distance' ? (
                  <Input
                    type="number"
                    placeholder="Amount per km"
                    value={form.chargePerKm}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, chargePerKm: event.target.value }))
                    }
                  />
                ) : (
                  <Input
                    type="number"
                    placeholder="Charge amount"
                    value={form.chargeAmount}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, chargeAmount: event.target.value }))
                    }
                  />
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    const kind = board.chargeKinds.find((item) => item.id === form.chargeKind);
                    const amount = Number(form.chargeAmount);
                    const perKm = Number(form.chargePerKm);
                    if (form.chargeKind === 'distance' && (!Number.isFinite(perKm) || perKm <= 0)) return;
                    if (form.chargeKind !== 'distance' && (!Number.isFinite(amount) || amount <= 0)) return;
                    setForm((current) => ({
                      ...current,
                      chargeAmount: '',
                      chargePerKm: '',
                      charges: [
                        ...current.charges,
                        {
                          kind: current.chargeKind,
                          label: kind?.label ?? 'Additional charge',
                          amountGhs: current.chargeKind === 'distance' ? 0 : amount,
                          perKmGhs: current.chargeKind === 'distance' ? perKm : undefined,
                          commissionable: current.chargeKind !== 'other',
                        },
                      ],
                    }));
                  }}
                >
                  Add charge
                </Button>
              </div>
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? 'Saving…' : 'Save service'}
              </Button>
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ServiceRow({
  service,
  busy,
  onEdit,
  onToggle,
  onRemove,
}: {
  service: CatalogueService;
  busy: boolean;
  onEdit: () => void;
  onToggle?: () => void;
  onRemove?: () => void;
}) {
  const offering = service.offering;
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{service.name}</p>
          <p className="text-sm text-muted-foreground">{service.description}</p>
          {offering ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={offering.active ? 'success' : 'subtle'}>
                {offering.active ? 'Active' : 'Disabled'}
              </Badge>
              <Badge variant="outline">{pricingModelLabel(offering.pricingModel)}</Badge>
              <span className="text-sm font-semibold">
                {formatPricingLabel(offering.pricingModel, offering.basePriceGhs)}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not in your active list</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onEdit}>
            {offering ? 'Edit price' : 'Add service'}
          </Button>
          {onToggle && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onToggle}>
              {offering?.active ? 'Disable' : 'Enable'}
            </Button>
          )}
          {onRemove && offering?.active && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
