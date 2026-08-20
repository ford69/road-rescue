import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  onValueChange,
  children,
  className,
  variant = 'pill',
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
  variant?: 'pill' | 'underline' | 'segment';
}) {
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange }}>
      <div className={className} data-variant={variant}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
  variant = 'pill',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'pill' | 'underline' | 'segment';
}) {
  const base =
    variant === 'segment'
      ? 'inline-flex items-center gap-1 rounded-xl bg-muted p-1'
      : variant === 'underline'
        ? 'flex items-center gap-6 border-b border-border'
        : 'inline-flex items-center gap-1 rounded-full bg-muted p-1';

  return <div className={cn(base, className)}>{children}</div>;
}

export function TabsTrigger({
  value,
  children,
  className,
  variant = 'pill',
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'pill' | 'underline' | 'segment';
}) {
  const ctx = React.useContext(TabsContext);
  const active = ctx?.value === value;

  const activeClasses = {
    pill: 'bg-card text-foreground shadow-soft',
    underline: 'border-b-2 border-primary text-foreground -mb-px',
    segment: 'bg-card text-foreground shadow-soft',
  };

  const inactiveClasses = {
    pill: 'text-muted-foreground hover:text-foreground',
    underline: 'text-muted-foreground hover:text-foreground border-b-2 border-transparent -mb-px',
    segment: 'text-muted-foreground hover:text-foreground',
  };

  return (
    <button
      onClick={() => ctx?.setValue(value)}
      className={cn(
        'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
        variant === 'underline' && 'rounded-none px-1 pb-2.5 pt-1',
        variant === 'segment' && 'rounded-lg',
        active ? activeClasses[variant] : inactiveClasses[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div className={cn('animate-fade-in-up', className)}>{children}</div>
  );
}
