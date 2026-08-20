import * as React from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-16 animate-fade-in-up',
        className,
      )}
    >
      {icon && (
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-bold tracking-tight mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs mb-6 text-balance">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
