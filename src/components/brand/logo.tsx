import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BRAND_ASSETS } from '@/lib/brand';

type LogoVariant = 'light' | 'dark' | 'icon';

const logoSources: Record<LogoVariant, string> = {
  light: BRAND_ASSETS.logoLight,
  dark: BRAND_ASSETS.logoDark,
  icon: BRAND_ASSETS.icon,
};

const sizeHeights = {
  sm: 40,
  md: 52,
  lg: 64,
  xl: 80,
} as const;

export function Logo({
  variant = 'light',
  className,
  to = '/',
  height,
  size = 'md',
  onClick,
}: {
  variant?: LogoVariant;
  className?: string;
  to?: string;
  height?: number;
  size?: keyof typeof sizeHeights;
  onClick?: () => void;
}) {
  const resolvedHeight = height ?? sizeHeights[size];
  const src = logoSources[variant];

  const isIcon = variant === 'icon';
  const image = (
    <img
      src={src}
      alt={isIcon ? '' : 'Road Rescue'}
      className={cn(
        'object-contain',
        isIcon
          ? 'shrink-0 rounded-lg'
          : 'w-auto max-w-[min(100%,280px)] object-left',
        className,
      )}
      style={
        isIcon
          ? { height: resolvedHeight, width: resolvedHeight }
          : { height: resolvedHeight }
      }
      height={resolvedHeight}
      width={isIcon ? resolvedHeight : undefined}
      loading="eager"
      decoding="async"
    />
  );

  const mark = isIcon ? (
    <span className="inline-flex items-center gap-2.5">
      {image}
      <span
        className={cn(
          'font-display font-bold tracking-tight text-white',
          size === 'sm' && 'text-base',
          size === 'md' && 'text-lg',
          (size === 'lg' || size === 'xl') && 'text-2xl',
        )}
      >
        Road Rescue
      </span>
    </span>
  ) : (
    image
  );

  if (to) {
    return (
      <Link
        to={to}
        onClick={onClick}
        className="inline-flex shrink-0 items-center"
        aria-label="Road Rescue home"
      >
        {mark}
      </Link>
    );
  }

  return mark;
}
