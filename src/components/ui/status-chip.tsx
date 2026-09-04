import * as React from 'react';
import { cn } from '@/lib/utils';

export type ServiceStatus =
  | 'searching'
  | 'requested'
  | 'assigned'
  | 'accepted'
  | 'enroute'
  | 'arrived'
  | 'inprogress'
  | 'awaiting_confirmation'
  | 'issue_reported'
  | 'completed'
  | 'cancelled'
  | 'pending'
  | 'available'
  | 'offline';

type ChipVariant = 'default' | 'soft' | 'solid';

const statusConfig: Record<
  ServiceStatus,
  { label: string; color: string; dot?: boolean; solid?: string }
> = {
  searching: {
    label: 'Searching',
    color: 'text-primary bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300',
    dot: true,
    solid: 'bg-primary text-primary-foreground',
  },
  requested: {
    label: 'Requested',
    color: 'text-primary bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300',
    dot: true,
    solid: 'bg-primary text-primary-foreground',
  },
  assigned: {
    label: 'Assigned',
    color: 'text-primary bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300',
    solid: 'bg-primary text-primary-foreground',
  },
  accepted: {
    label: 'Accepted',
    color: 'text-primary bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300',
    solid: 'bg-primary text-primary-foreground',
  },
  enroute: {
    label: 'En route',
    color: 'text-primary bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300',
    dot: true,
    solid: 'bg-primary text-primary-foreground',
  },
  arrived: {
    label: 'Arrived',
    color: 'text-warning bg-warning-50 dark:bg-warning-700/20 dark:text-warning-500',
    solid: 'bg-warning text-warning-foreground',
  },
  inprogress: {
    label: 'In progress',
    color: 'text-warning bg-warning-50 dark:bg-warning-700/20 dark:text-warning-500',
    dot: true,
    solid: 'bg-warning text-warning-foreground',
  },
  awaiting_confirmation: {
    label: 'Awaiting your confirmation',
    color: 'text-primary bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300',
    dot: true,
    solid: 'bg-primary text-primary-foreground',
  },
  issue_reported: {
    label: 'Issue reported',
    color: 'text-critical bg-critical/10 dark:text-critical',
    solid: 'bg-critical text-critical-foreground',
  },
  completed: {
    label: 'Completed',
    color: 'text-success bg-success-50 dark:bg-success-700/20 dark:text-success-500',
    solid: 'bg-success text-success-foreground',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-muted-foreground bg-muted',
    solid: 'bg-muted-foreground text-background',
  },
  pending: {
    label: 'Pending',
    color: 'text-warning bg-warning-50 dark:bg-warning-700/20 dark:text-warning-500',
    solid: 'bg-warning text-warning-foreground',
  },
  available: {
    label: 'Available',
    color: 'text-success bg-success-50 dark:bg-success-700/20 dark:text-success-500',
    dot: true,
    solid: 'bg-success text-success-foreground',
  },
  offline: {
    label: 'Offline',
    color: 'text-muted-foreground bg-muted',
    solid: 'bg-muted-foreground text-background',
  },
};

export function StatusChip({
  status,
  variant = 'soft',
  className,
  label,
}: {
  status: ServiceStatus;
  variant?: ChipVariant;
  className?: string;
  label?: string;
}) {
  const config = statusConfig[status];
  const text = label ?? config.label;

  const variantClass =
    variant === 'solid'
      ? config.solid
      : variant === 'default'
        ? 'border border-border text-foreground'
        : config.color;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        variantClass,
        className,
      )}
    >
      {config.dot && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {text}
    </span>
  );
}
