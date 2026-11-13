import * as React from 'react';
import { MapPin, Phone, Mail, Star } from 'lucide-react';
import type { MechanicDto, ProviderServiceOfferingDto } from '@/api/types';
import { adminApi } from '@/api/repositories';
import { formatPricingLabel } from '@/lib/pricing';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { mechanicDisplayName, mechanicInitials, serviceTypeConfig } from '@/lib/service-config';
import { DISPLAY_RATING } from '@/lib/ratings';
import { resolveMediaUrl } from '@/lib/user-display';
import { ProviderFinancePanel } from '@/components/admin/provider-finance-panel';

export function MechanicVerificationSheet({
  mechanic,
  open,
  onClose,
  busy,
  onApprove,
  onReject,
}: {
  mechanic: MechanicDto | null;
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [offerings, setOfferings] = React.useState<ProviderServiceOfferingDto[]>([]);

  React.useEffect(() => {
    if (!mechanic) {
      setOfferings([]);
      return;
    }
    let cancelled = false;
    void adminApi
      .providerServices(mechanic._id)
      .then((result) => {
        if (!cancelled) setOfferings(result.offerings);
      })
      .catch(() => {
        if (!cancelled) setOfferings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mechanic]);

  if (!mechanic) return null;

  const name = mechanicDisplayName(mechanic);
  const avatarSrc = resolveMediaUrl(mechanic.userId?.avatar);
  const verification = mechanic.verificationStatus ?? 'pending';
  const documentUrls = [
    ...(mechanic.documents ?? []),
    ...(mechanic.userId?.avatar && !mechanic.documents?.includes(mechanic.userId.avatar)
      ? [mechanic.userId.avatar]
      : []),
  ]
    .map((doc) => resolveMediaUrl(doc))
    .filter((url): url is string => Boolean(url));

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh]">
        <SheetHeader
          title="Provider verification"
          description="Review application details before approving or rejecting."
          onClose={onClose}
        />
        <SheetBody>
          <div className="space-y-6 pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar
                src={avatarSrc}
                alt={name}
                fallback={mechanicInitials(name)}
                size="xl"
                className="h-24 w-24"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl font-bold">{name}</h2>
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
                <p className="mt-1 text-sm text-muted-foreground">{mechanic.garageName}</p>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {mechanic.userId?.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0" />
                      {mechanic.userId.email}
                    </p>
                  )}
                  {mechanic.userId?.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0" />
                      {mechanic.userId.phone}
                    </p>
                  )}
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {mechanic.location.address}, {mechanic.location.city}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoBlock label="Ghana Card" value={mechanic.ghanaCardNumber ?? 'Not provided'} />
              <InfoBlock label="Experience" value={`${mechanic.experience ?? 0} years`} />
              <InfoBlock label="Service vehicle" value={mechanic.truck ?? 'Not provided'} />
              <InfoBlock
                label="Rating / jobs"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-warning text-warning" />
                    {DISPLAY_RATING.toFixed(1)} · {mechanic.completedJobs} jobs
                  </span>
                }
              />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Provider prices
              </p>
              <div className="mt-2 space-y-2">
                {offerings.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No priced services yet</span>
                ) : (
                  offerings.map((offering) => (
                    <div key={offering.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        {serviceTypeConfig[offering.serviceType]?.label ?? offering.serviceType}
                        {!offering.active ? ' (disabled)' : ''}
                        {offering.pricingModel === 'quote' ? ' · quote' : ''}
                      </span>
                      <span className="font-semibold">
                        {formatPricingLabel(offering.pricingModel, offering.basePriceGhs)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Specialties
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(mechanic.specialties ?? []).length === 0 ? (
                  <span className="text-sm text-muted-foreground">None listed</span>
                ) : (
                  mechanic.specialties.map((slug) => (
                    <Badge key={slug} variant="outline">
                      {serviceTypeConfig[slug]?.label ?? slug}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {documentUrls.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Verification photos
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {documentUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="image-frame aspect-square overflow-hidden"
                    >
                      <img src={url} alt="Provider verification" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <ProviderFinancePanel mechanicId={mechanic._id} />

            {verification === 'pending' && (
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                <Button variant="outline" disabled={busy} onClick={onReject}>
                  Reject application
                </Button>
                <Button disabled={busy} onClick={onApprove}>
                  {busy ? 'Saving…' : 'Approve provider'}
                </Button>
              </div>
            )}
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
