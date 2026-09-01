import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Phone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

const navLinks = [
  { href: '#home', label: 'Home' },
  { href: '#services', label: 'Services' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
] as const;

export function SiteNav({ onRequestHelp }: { onRequestHelp: () => void }) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const close = () => setOpen(false);
  const overHero = !scrolled;

  const handleNav = (href: string) => {
    close();
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 safe-top">
      {/* Utility strip */}
      <div
        className={cn(
          'border-b transition-colors duration-300',
          overHero
            ? 'border-white/10 bg-brand-black/40 backdrop-blur-md'
            : 'border-border/60 bg-brand-black text-white',
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs font-medium lg:px-8">
          <p
            className={cn(
              'tracking-wide transition-colors',
              overHero ? 'text-white/85' : 'text-white/90',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              24/7 Emergency Roadside Assistance · Ghana
            </span>
          </p>
          <a
            href="tel:+233000000000"
            className={cn(
              'hidden items-center gap-1.5 font-semibold transition-colors sm:inline-flex',
              overHero ? 'text-white/90 hover:text-white' : 'text-white/90 hover:text-primary',
            )}
          >
            <Phone className="h-3.5 w-3.5" />
            Call for help
          </a>
        </div>
      </div>

      {/* Main nav */}
      <div
        className={cn(
          'border-b transition-all duration-300',
          overHero
            ? 'border-white/10 bg-brand-black/25 backdrop-blur-xl'
            : 'border-border/80 bg-white/90 shadow-[0_8px_32px_-12px_rgba(14,44,74,0.18)] backdrop-blur-xl',
        )}
      >
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 lg:h-[4.75rem] lg:px-8">
          <Logo
            variant={overHero ? 'dark' : 'light'}
            size="lg"
            to="/"
            className="max-w-[180px] sm:max-w-[220px]"
          />

          <nav
            className={cn(
              'hidden items-center rounded-full border p-1 lg:flex',
              overHero
                ? 'border-white/15 bg-white/10'
                : 'border-border/80 bg-muted/50',
            )}
            aria-label="Main"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(link.href);
                }}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-all',
                  overHero
                    ? 'text-white/80 hover:bg-white/15 hover:text-white'
                    : 'text-foreground/70 hover:bg-white hover:text-brand-blue',
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                overHero && 'text-white hover:bg-white/15 hover:text-white',
              )}
              onClick={() => navigate('/auth/login')}
            >
              Login
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                overHero &&
                  'border-white/35 bg-white/5 text-white hover:bg-white/15 hover:text-white',
              )}
              onClick={() => navigate('/auth/register')}
            >
              Get Started
            </Button>
            <Button
              variant="primary"
              size="sm"
              className={cn(
                overHero && 'shadow-[0_4px_20px_-4px_rgba(255,204,0,0.55)]',
              )}
              onClick={onRequestHelp}
            >
              Request Help
            </Button>
          </div>

          <button
            type="button"
            className={cn(
              'rounded-full border p-2.5 transition-colors lg:hidden',
              overHero
                ? 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                : 'border-border bg-card text-foreground hover:bg-muted',
            )}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div
          className="absolute inset-0 bg-brand-black/60 backdrop-blur-sm"
          onClick={close}
          aria-hidden="true"
        />
        <div
          className={cn(
            'absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-border bg-white shadow-elevated transition-transform duration-300 ease-out',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Logo variant="light" size="md" to="/" onClick={close} />
            <button
              type="button"
              className="rounded-full p-2 text-foreground hover:bg-muted"
              aria-label="Close menu"
              onClick={close}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5" aria-label="Mobile">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(link.href);
                }}
                className="block rounded-xl px-3 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-muted"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="space-y-2 border-t border-border p-4 safe-bottom">
            <Button variant="outline" fullWidth onClick={() => { close(); navigate('/auth/login'); }}>
              Login
            </Button>
            <Button variant="primary" fullWidth onClick={() => { close(); navigate('/auth/register'); }}>
              Get Started
            </Button>
            <Button variant="secondary" fullWidth onClick={() => { close(); onRequestHelp(); }}>
              Request Help
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
