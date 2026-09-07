import * as React from 'react';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { StarRatingInput } from '@/components/ratings/star-rating';
import { requestsApi } from '@/api/repositories';
import { ApiClientError } from '@/api/client/http';
import { useToast } from '@/components/ui/toast';
import { mechanicDisplayName, serviceTypeConfig } from '@/lib/service-config';
import type { RescueRequestDto } from '@/api/types';

export function RateProviderSheet({
  request,
  open,
  onOpenChange,
  onRated,
}: {
  request: RescueRequestDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRated: () => void;
}) {
  const { toast } = useToast();
  const [stars, setStars] = React.useState(0);
  const [review, setReview] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStars(0);
      setReview('');
      setSubmitting(false);
    }
  }, [open, request?._id]);

  if (!request) return null;

  const mechanicName = request.mechanic ? mechanicDisplayName(request.mechanic) : 'your mechanic';
  const serviceLabel = serviceTypeConfig[request.serviceType]?.label ?? request.serviceType;

  const submit = async () => {
    if (stars < 1) {
      toast({ type: 'error', title: 'Select a rating', description: 'Please choose 1 to 5 stars.' });
      return;
    }
    setSubmitting(true);
    try {
      await requestsApi.rate(request._id, {
        stars,
        review: review.trim() || undefined,
      });
      toast({
        type: 'success',
        title: 'Rating submitted successfully.',
        description: `Thanks for rating ${mechanicName}.`,
      });
      onOpenChange(false);
      onRated();
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'ALREADY_RATED') {
        toast({
          type: 'error',
          title: 'You have already rated this service.',
        });
        return;
      }
      if (error instanceof ApiClientError && error.code === 'SERVICE_NOT_COMPLETED') {
        toast({
          type: 'error',
          title: 'You can rate this provider after the service is completed.',
        });
        return;
      }
      if (error instanceof ApiClientError && error.status === 400) {
        toast({
          type: 'error',
          title: error.message,
        });
        return;
      }
      toast({
        type: 'error',
        title: "We couldn't submit your rating.",
        description: 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-y-auto">
        <SheetHeader title="How was your service?" description={`${serviceLabel} · ${mechanicName}`} />
        <div className="space-y-4 px-5 pb-6">
          <StarRatingInput value={stars} onChange={setStars} disabled={submitting} />
          <div className="space-y-1.5">
            <label htmlFor="provider-review" className="text-sm font-semibold">
              Write a review (optional)
            </label>
            <Textarea
              id="provider-review"
              value={review}
              onChange={(event) => setReview(event.target.value)}
              maxLength={1000}
              disabled={submitting}
              placeholder="The mechanic was professional and arrived quickly."
            />
          </div>
          <Button fullWidth size="lg" disabled={submitting || stars < 1} onClick={() => void submit()}>
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
