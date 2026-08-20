import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <SheetContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetContent({
  children,
  side = 'bottom',
  className,
  showHandle = true,
}: {
  children: React.ReactNode;
  side?: 'bottom' | 'right' | 'top';
  className?: string;
  showHandle?: boolean;
}) {
  const ctx = React.useContext(SheetContext);
  const [rendered, setRendered] = React.useState(ctx?.open ?? false);

  React.useEffect(() => {
    if (ctx?.open) {
      setRendered(true);
    } else {
      const t = setTimeout(() => setRendered(false), 300);
      return () => clearTimeout(t);
    }
  }, [ctx?.open]);

  if (!rendered) return null;

  const sideClasses = {
    bottom:
      'inset-x-0 bottom-0 top-auto rounded-t-3xl animate-slide-up max-h-[90vh]',
    right:
      'inset-y-0 right-0 left-auto w-full max-w-md rounded-l-3xl animate-fade-in',
    top: 'inset-x-0 top-0 bottom-auto rounded-b-3xl animate-fade-in',
  };

  return (
    <div className="fixed inset-0 z-[1000]">
      <div
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          ctx?.open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => ctx?.setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute glass shadow-elevated flex flex-col',
          sideClasses[side],
          ctx?.open ? 'translate-y-0' : 'translate-y-full',
          'transition-transform duration-300 ease-out',
          className,
        )}
      >
        {showHandle && side === 'bottom' && (
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({
  title,
  description,
  onClose,
  className,
}: {
  title: string;
  description?: string;
  onClose?: () => void;
  className?: string;
}) {
  const ctx = React.useContext(SheetContext);
  return (
    <div className={cn('px-5 pb-3 shrink-0', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <button
          onClick={() => {
            onClose?.();
            ctx?.setOpen(false);
          }}
          className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function SheetBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-5 pb-5', className)}>
      {children}
    </div>
  );
}

export function SheetFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'shrink-0 border-t border-border bg-card/50 p-4 safe-bottom',
        className,
      )}
    >
      {children}
    </div>
  );
}
