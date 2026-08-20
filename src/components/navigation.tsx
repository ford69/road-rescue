import * as React from 'react';
import {
  Home,
  Map,
  Clock,
  Bell,
  User,
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  LifeBuoy,
  Menu,
  X,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role } from '@/api/types';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar } from '@/components/ui/avatar';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const customerNav: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'track', label: 'Track', icon: Map },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'profile', label: 'Profile', icon: User },
];

const mechanicNav: NavItem[] = [
  { id: 'home', label: 'Jobs', icon: Briefcase },
  { id: 'track', label: 'Map', icon: Map },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'profile', label: 'Profile', icon: User },
];

const adminNav: NavItem[] = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'track', label: 'Live Jobs', icon: Map },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const adminSidebar: NavItem[] = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'track', label: 'Live Jobs', icon: Map },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'mechanics', label: 'Mechanics', icon: Briefcase },
  { id: 'payments', label: 'Payments', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function getNavItems(role: Role): NavItem[] {
  if (role === 'mechanic') return mechanicNav;
  if (role === 'admin') return adminNav;
  return customerNav;
}

/* Mobile Bottom Navigation */
export function MobileNav({
  role,
  active,
  onNavigate,
  onEmergency,
}: {
  role: Role;
  active: string;
  onNavigate: (id: string) => void;
  onEmergency?: () => void;
}) {
  const items = getNavItems(role);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      <div className="glass border-t border-border safe-bottom">
        <div className="flex items-center justify-around px-2 py-1.5">
          {items.map((item, i) => {
            const isActive = active === item.id;
            // Insert emergency FAB in the middle
            if (i === 2 && role === 'customer' && onEmergency) {
              return (
                <React.Fragment key={`fab-${item.id}`}>
                  <button
                    onClick={onEmergency}
                    className="relative -mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-critical text-critical-foreground shadow-elevated active:scale-95 transition-transform"
                    aria-label="Emergency assistance"
                  >
                    <span className="absolute inset-0 rounded-full bg-critical animate-pulse-ring opacity-60" />
                    <ShieldAlert className="relative h-6 w-6" />
                  </button>
                  <NavButton
                    key={item.id}
                    item={item}
                    isActive={isActive}
                    onClick={() => onNavigate(item.id)}
                  />
                </React.Fragment>
              );
            }
            return (
              <NavButton
                key={item.id}
                item={item}
                isActive={isActive}
                onClick={() => onNavigate(item.id)}
              />
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors min-h-[44px]',
        isActive ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-semibold">{item.label}</span>
    </button>
  );
}

/* Desktop Sidebar */
export function DesktopSidebar({
  role,
  active,
  onNavigate,
  collapsed,
  onToggleCollapse,
}: {
  role: Role;
  active: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const items = role === 'admin' ? adminSidebar : getNavItems(role);

  return (
    <aside
      className={cn(
        'hidden lg:flex fixed left-0 top-0 bottom-0 z-30 flex-col border-r border-border bg-card transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-primary dark:bg-zinc-800 dark:text-primary">
          <LifeBuoy className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-display text-lg font-bold leading-none tracking-tight">
              Road Rescue
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              24/7 Assistance
            </p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-soft'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                collapsed && 'justify-center',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-3">
        <button
          onClick={onToggleCollapse}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all',
            collapsed && 'justify-center',
          )}
        >
          <Menu className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

/* Top Bar */
export function TopBar({
  onOpenMenu,
  onOpenSearch,
  title,
  notificationCount,
  onOpenNotifications,
}: {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  title: string;
  notificationCount: number;
  onOpenNotifications: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 glass border-b border-border safe-top">
      <div className="flex h-16 items-center gap-3 px-4">
        {/* Mobile menu */}
        <button
          onClick={onOpenMenu}
          className="lg:hidden rounded-xl p-2 text-foreground hover:bg-accent"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-lg font-bold tracking-tight truncate">
            {title}
          </h1>
        </div>

        {/* Search (desktop) */}
        <button
          onClick={onOpenSearch}
          className="hidden md:flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors w-56"
        >
          <Search className="h-4 w-4" />
          <span>Search...</span>
          <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
            ⌘K
          </kbd>
        </button>

        {/* Search (mobile) */}
        <button
          onClick={onOpenSearch}
          className="md:hidden rounded-xl p-2 text-foreground hover:bg-accent"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <button
          onClick={onOpenNotifications}
          className="relative rounded-xl p-2 text-foreground hover:bg-accent"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-critical-foreground">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User avatar */}
        <Avatar
          fallback="JD"
          size="md"
          className="hidden sm:flex ring-2 ring-border"
        />
      </div>
    </header>
  );
}

/* Mobile slide-out menu */
export function MobileMenu({
  open,
  onClose,
  role,
  onNavigate,
  active,
}: {
  open: boolean;
  onClose: () => void;
  role: Role;
  onNavigate: (id: string) => void;
  active: string;
}) {
  const items = getNavItems(role);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 lg:hidden',
        !open && 'pointer-events-none',
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-72 max-w-[80vw] glass border-r border-border flex flex-col transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-primary dark:bg-zinc-800 dark:text-primary">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display font-bold leading-none">Road Rescue</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">24/7 Assistance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-accent"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User card */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar fallback="JD" size="lg" ring />
            <div className="min-w-0">
              <p className="font-semibold truncate">Jordan Davis</p>
              <p className="text-sm text-muted-foreground truncate">
                {role === 'customer'
                  ? 'Premium Member'
                  : role === 'mechanic'
                    ? 'Top Rated'
                    : 'Administrator'}
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent',
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
