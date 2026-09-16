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

      <Card className="p-5 space-y-3">
        <h2 className="font-display text-base font-bold">Services offered</h2>
        <div className="flex flex-wrap gap-2">
          {ensureArray(profile.specialties).length === 0 ? (
            <p className="text-sm text-muted-foreground">No specialties listed yet.</p>
          ) : (
            ensureArray(profile.specialties).map((slug) => (
              <Badge key={slug} variant="outline">
                {serviceTypeConfig[slug]?.label ?? slug}
              </Badge>
            ))
          )}
        </div>
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
