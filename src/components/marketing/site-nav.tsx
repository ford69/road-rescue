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
    const onScroll = () => setScrolled(window.scrollY > 24);
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

  const handleNav = (href: string) => {
    close();
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 safe-top">
      {/* Utility strip — always glass */}
      <div className="border-b border-white/10 bg-brand-black/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs font-medium lg:px-8">
          <p className="tracking-wide text-white/85">
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
            className="hidden items-center gap-1.5 font-semibold text-white/90 transition-colors hover:text-primary sm:inline-flex"
          >
            <Phone className="h-3.5 w-3.5" />
            Call for help
          </a>
        </div>
      </div>

      {/* Main nav — stays transparent on scroll */}
      <div
        className={cn(
          'border-b border-white/10 bg-brand-black/25 backdrop-blur-xl transition-shadow duration-300',
          scrolled && 'shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)]',
        )}
      >
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 lg:h-[4.75rem] lg:px-8">
          <Logo
            variant="dark"
            size="lg"
            to="/"
            className="max-w-[180px] sm:max-w-[220px]"
          />

          <nav
            className="hidden items-center rounded-full border border-white/15 bg-white/10 p-1 lg:flex"
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
                className="rounded-full px-4 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary/15 hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => navigate('/auth/login')}
            >
              Login
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/35 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              onClick={() => navigate('/auth/register')}
            >
              Get Started
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="shadow-[0_4px_20px_-4px_rgba(255,204,0,0.55)]"
              onClick={onRequestHelp}
            >
              Get help now
            </Button>
          </div>

          <button
            type="button"
            className="rounded-full border border-white/25 bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 lg:hidden"
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
            'absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-white/10 bg-brand-black/90 shadow-elevated backdrop-blur-xl transition-transform duration-300 ease-out',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <Logo variant="dark" size="md" to="/" onClick={close} />
            <button
              type="button"
              className="rounded-full p-2 text-white hover:bg-white/10"
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
                className="block rounded-xl px-3 py-3.5 text-base font-semibold text-white/90 transition-colors hover:bg-white/10"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="space-y-2 border-t border-white/10 p-4 safe-bottom">
            <Button
              variant="outline"
              fullWidth
              className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              onClick={() => { close(); navigate('/auth/login'); }}
            >
              Login
            </Button>
            <Button variant="primary" fullWidth onClick={() => { close(); navigate('/auth/register'); }}>
              Get Started
            </Button>
            <Button
              variant="secondary"
              fullWidth
              className="bg-white/10 text-white hover:bg-white/20"
              onClick={() => { close(); onRequestHelp(); }}
            >
              Get help now
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
