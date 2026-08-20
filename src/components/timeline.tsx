import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TimelineItem {
  title: string;
  time?: string;
  description?: string;
  status: 'done' | 'current' | 'pending';
  icon?: React.ReactNode;
}

export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <ol className={cn('relative space-y-6', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const dotColor =
          item.status === 'done'
            ? 'bg-success text-success-foreground'
            : item.status === 'current'
              ? 'bg-primary text-primary-foreground ring-4 ring-primary-200 dark:ring-primary-900/50'
              : 'bg-muted text-muted-foreground';

        return (
          <li key={i} className="relative flex gap-4">
            {/* Line */}
            {!isLast && (
              <div
                className={cn(
                  'absolute left-5 top-10 -bottom-6 w-0.5',
                  item.status === 'done' ? 'bg-success' : 'bg-border',
                )}
              />
            )}
            {/* Dot */}
            <div
              className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all',
                dotColor,
                item.status === 'current' && 'animate-pulse-soft',
              )}
            >
              {item.icon ?? (item.status === 'done' ? (
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="h-2 w-2 rounded-full bg-current" />
              ))}
            </div>
            {/* Content */}
            <div className="flex-1 pt-1.5">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    'font-semibold text-sm',
                    item.status === 'pending' && 'text-muted-foreground',
                  )}
                >
                  {item.title}
                </p>
                {item.time && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.time}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
