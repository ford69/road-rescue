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

  const image = (
    <img
      src={src}
      alt="Road Rescue"
      className={cn('w-auto max-w-[min(100%,280px)] object-contain object-left', className)}
      style={{ height: resolvedHeight }}
      height={resolvedHeight}
      loading="eager"
      decoding="async"
    />
  );

  if (to) {
    return (
      <Link
        to={to}
        onClick={onClick}
        className="inline-flex shrink-0 items-center"
        aria-label="Road Rescue home"
      >
        {image}
      </Link>
    );
  }

  return image;
}
