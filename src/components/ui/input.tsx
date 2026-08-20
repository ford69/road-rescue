import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    icon?: React.ReactNode;
    error?: boolean;
  }
>(({ className, icon, error, ...props }, ref) => (
  <div className="relative w-full">
    {icon && (
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
    )}
    <input
      ref={ref}
      className={cn(
        'flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground transition-all duration-200',
        'placeholder:text-muted-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        icon && 'pl-11',
        error && 'border-critical focus:ring-critical',
        className,
      )}
      {...props}
    />
  </div>
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[88px] w-full rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground transition-all duration-200',
      'placeholder:text-muted-foreground',
      'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
      'disabled:opacity-50 disabled:cursor-not-allowed resize-none',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      'text-sm font-semibold text-foreground leading-none mb-2 block',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && <Label>{label}</Label>}
      {children}
      {error ? (
        <p className="text-xs text-critical font-medium">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
