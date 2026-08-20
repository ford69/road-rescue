import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'critical'
  | 'success'
  | 'subtle';

type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-soft hover:bg-primary-700 active:scale-[0.98]',
  secondary:
    'bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]',
  outline:
    'border border-border bg-card text-foreground hover:bg-accent active:scale-[0.98]',
  ghost:
    'text-foreground hover:bg-accent active:scale-[0.98]',
  critical:
    'bg-critical text-critical-foreground shadow-soft hover:bg-critical-600 active:scale-[0.98]',
  success:
    'bg-success text-success-foreground shadow-soft hover:bg-success-600 active:scale-[0.98]',
  subtle:
    'bg-accent text-foreground hover:bg-accent/80 active:scale-[0.98]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  xl: 'h-14 px-8 text-base gap-2.5 rounded-2xl',
  icon: 'h-11 w-11 rounded-xl',
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 select-none tap-highlight',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
