import * as React from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function joinInfo(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join('\n\n');
}

export function InfoTooltip({
  text,
  label = 'About this',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const id = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

  const place = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const below = rect.bottom + 8;
    const estimatedHeight = Math.min(240, 24 + text.length * 0.35);
    const top =
      below + estimatedHeight > window.innerHeight - 8
        ? Math.max(8, rect.top - estimatedHeight - 8)
        : below;
    setCoords({ top, left });
  }, [text.length]);

  React.useEffect(() => {
    if (!open) return;
    place();
    const close = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', close);
    };
  }, [open, place]);

  const finePointer = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'inline-flex shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'touch') setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          if (finePointer()) return;
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && coords && typeof document !== 'undefined'
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              style={{ top: coords.top, left: coords.left }}
              className="pointer-events-none fixed z-[1100] w-[min(18rem,calc(100vw-1rem))] whitespace-pre-line rounded-lg border border-border bg-popover px-3 py-2 text-left text-xs leading-5 text-popover-foreground shadow-elevated"
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

export function InfoHeading({
  as: Tag = 'h2',
  children,
  info,
  className,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'p';
  children: React.ReactNode;
  info: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Tag className={className}>{children}</Tag>
      <InfoTooltip text={info} />
    </div>
  );
}
