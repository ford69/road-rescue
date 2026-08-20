import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'critical'
  | 'outline'
  | 'subtle';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-foreground text-background',
  primary: 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
  success: 'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-500',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-700/20 dark:text-warning-500',
  critical: 'bg-critical-50 text-critical-700 dark:bg-critical-700/20 dark:text-critical-500',
  outline: 'border border-border text-foreground',
  subtle: 'bg-accent text-muted-foreground',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
      )}
      {children}
    </span>
  );
}
