import * as React from 'react';
import { cn } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
};

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: AvatarSize;
  ring?: boolean;
}

export function Avatar({
  src,
  alt,
  fallback,
  size = 'md',
  ring,
  className,
  ...props
}: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);
  const showImg = src && !imgError;

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-semibold text-foreground',
        sizeClasses[size],
        ring && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
        className,
      )}
      {...props}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="select-none">{fallback}</span>
      )}
    </div>
  );
}

export function AvatarGroup({
  children,
  max = 4,
  className,
}: {
  children: React.ReactNode;
  max?: number;
  className?: string;
}) {
  const items = React.Children.toArray(children);
  const visible = items.slice(0, max);
  const overflow = items.length - max;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visible.map((child, i) => (
        <div key={i} className="ring-2 ring-card rounded-full">
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <div className="ring-2 ring-card rounded-full h-10 w-10 flex items-center justify-center text-xs font-semibold bg-accent text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
