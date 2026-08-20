import * as React from 'react';
import { cn } from '@/lib/utils';

type ProgressColor = 'primary' | 'success' | 'warning' | 'critical';

const colorClasses: Record<ProgressColor, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-critical',
};

export interface ProgressProps {
  value: number;
  max?: number;
  color?: ProgressColor;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function Progress({
  value,
  max = 100,
  color = 'primary',
  size = 'md',
  showLabel = false,
  className,
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-muted',
          sizes[size],
        )}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            colorClasses[color],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="mt-1 block text-right text-xs font-medium text-muted-foreground">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

export function CircularProgress({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  color = 'primary',
  children,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: ProgressColor;
  children?: React.ReactNode;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const colorMap: Record<ProgressColor, string> = {
    primary: 'stroke-primary',
    success: 'stroke-success',
    warning: 'stroke-warning',
    critical: 'stroke-critical',
  };

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-500 ease-out', colorMap[color])}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
