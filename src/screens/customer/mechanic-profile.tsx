import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, ShieldCheck, Star, Wrench } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/status-chip';
import { mechanicsApi } from '@/api/repositories';
import type { MechanicPublicProfileDto } from '@/api/types';
import { mechanicInitials, serviceTypeConfig } from '@/lib/service-config';
import {
  formatChargeLine,
  formatPricingLabel,
  formatProviderPriceRange,
  pricingModelLabel,
} from '@/lib/pricing';
import { DISPLAY_RATING, DISPLAY_REVIEW_COUNT } from '@/lib/ratings';
import { resolveMediaUrl } from '@/lib/user-display';
import { ApiClientError } from '@/api/client/http';
import { ensureArray } from '@/lib/ensure-array';

export function MechanicProfilePage({ mechanicId: mechanicIdProp }: { mechanicId?: string }) {
  const { id, mechanicId: mechanicIdParam } = useParams();
  const mechanicId = mechanicIdProp ?? id ?? mechanicIdParam;
  const navigate = useNavigate();
  const [profile, setProfile] = React.useState<MechanicPublicProfileDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!mechanicId) {
      setLoading(false);
      setError('Provider not found');
      return;
    }
    let cancelled = false;
    void mechanicsApi
      .publicProfile(mechanicId)
      .then((nextProfile) => {
        if (cancelled) return;
        setProfile(nextProfile);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : 'Could not load provider profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mechanicId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading provider profile…</p>;
  }
  if (error || !profile) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-critical">{error ?? 'Provider not found'}</p>
        <Button variant="outline" onClick={() => navigate('/customer/home')}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <Avatar
            src={resolveMediaUrl(profile.avatar ?? undefined)}
            alt={profile.name}
            fallback={mechanicInitials(profile.name)}
            size="xl"
            ring
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight">{profile.name}</h1>
              {profile.verificationStatus === 'verified' && (
                <Badge variant="primary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{profile.garageName}</p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold">
                <Star className="h-4 w-4 fill-warning text-warning" />
                {DISPLAY_RATING.toFixed(1)}
              </span>
              <span className="text-muted-foreground">
                {DISPLAY_REVIEW_COUNT} reviews
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip status={profile.availability ? 'available' : 'offline'} />
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {profile.city || 'Ghana'}
          </span>
          <span className="text-sm text-muted-foreground">{profile.experience} years experience</span>
          <span className="text-sm text-muted-foreground">{profile.completedJobs} completed services</span>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold">Services & pricing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prices are set by this provider. Starting-from amounts can change after inspection.
            </p>
          </div>
          {ensureArray(profile.services).length > 0 && (
            <p className="shrink-0 font-display text-lg font-bold">
              {formatProviderPriceRange(profile.priceRange, profile.services)}
            </p>
          )}
        </div>
        {ensureArray(profile.services).length > 0 ? (
          <div className="space-y-3">
            {profile.services!.map((service) => {
              const name =
                service.serviceName ?? serviceTypeConfig[service.serviceType]?.label ?? service.serviceType;
              const description =
                service.serviceDescription ||
                serviceTypeConfig[service.serviceType]?.description ||
                '';
              return (
                <div key={service.id} className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{name}</p>
                      {service.categoryName && (
                        <p className="text-xs text-muted-foreground">{service.categoryName}</p>
                      )}
                    </div>
                    <p className="shrink-0 font-display text-base font-bold">
                      {formatPricingLabel(service.pricingModel, service.basePriceGhs)}
                    </p>
                  </div>
                  {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {pricingModelLabel(service.pricingModel)}
                    {service.pricingModel === 'starting_from'
                      ? ' · final price needs confirmation'
                      : ''}
                    {service.partsNotIncluded ? ' · parts not included' : ''}
                  </p>
                  {ensureArray(service.additionalCharges).length > 0 && (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {service.additionalCharges.map((charge) => (
                        <li key={`${charge.kind}-${charge.label}`}>{formatChargeLine(charge)}</li>
                      ))}
                    </ul>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/customer/request?service=${service.serviceType}`)}
                  >
                    Request this service
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ensureArray(profile.specialties).length === 0 ? (
              <p className="text-sm text-muted-foreground">No priced services listed yet.</p>
            ) : (
              ensureArray(profile.specialties).map((slug) => (
                <Badge key={slug} variant="outline">
                  {serviceTypeConfig[slug]?.label ?? slug}
                </Badge>
              ))
            )}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-base font-bold">Customer Reviews</h2>
        <Card className="p-5 text-sm text-muted-foreground">
          Ratings are not available yet. Provider scores currently default to {DISPLAY_RATING.toFixed(1)}.
        </Card>
      </div>

      <Button fullWidth onClick={() => navigate('/customer/request')}>
        <Wrench className="h-4 w-4" />
        Request assistance
      </Button>
    </div>
  );
}
