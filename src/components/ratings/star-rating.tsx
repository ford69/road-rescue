import * as React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatRating(value: number): string {
  return value.toFixed(1);
}

export function StarRatingDisplay({
  stars,
  showValue = true,
  size = 'sm',
}: {
  stars: number;
  showValue?: boolean;
  size?: 'sm' | 'md';
}) {
  const iconClass = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const filled = Math.round(stars);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(
            iconClass,
            value <= filled ? 'fill-warning text-warning' : 'text-muted-foreground',
          )}
        />
      ))}
      {showValue && (
        <span className="ml-1 text-sm font-semibold">{formatRating(stars)}</span>
      )}
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (stars: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = React.useState(0);
  const shown = hovered || value;
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((stars) => (
        <button
          key={stars}
          type="button"
          role="radio"
          aria-checked={value === stars}
          aria-label={`${stars} star${stars === 1 ? '' : 's'}`}
          disabled={disabled}
          className="rounded-lg p-1 disabled:opacity-50"
          onMouseEnter={() => setHovered(stars)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(stars)}
        >
          <Star
            className={cn(
              'h-8 w-8',
              stars <= shown ? 'fill-warning text-warning' : 'text-muted-foreground',
            )}
          />
        </button>
      ))}
    </div>
  );
}
