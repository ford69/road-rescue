import * as React from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import {
  MobileNav,
  DesktopSidebar,
  TopBar,
  MobileMenu,
} from '@/components/navigation';
import { Sheet, SheetContent, SheetHeader, SheetBody } from '@/components/ui/sheet';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Role, ServiceType } from '@/api/types';
import { EMAIL_NOT_VERIFIED_EVENT, SUBSCRIPTION_REQUIRED_EVENT } from '@/api/client/http';
import { useAuth } from '@/context/auth-context';

import { MechanicProfilePage } from '@/screens/customer/mechanic-profile';
import { CustomerHome } from '@/screens/customer/home';
import { RequestFlow } from '@/screens/customer/request-flow';
import { LiveTracking } from '@/screens/customer/live-tracking';
import { ServiceHistory } from '@/screens/customer/service-history';
import { Profile } from '@/screens/customer/profile';
import { CustomerSubscriptionPage } from '@/screens/customer/subscription';
import { Notifications } from '@/screens/customer/notifications';
import { HelpSupport } from '@/screens/help-support';
import { MechanicHome, MechanicEarnings, MechanicJobHistory } from '@/screens/mechanic/home';
import { MechanicActiveJob } from '@/screens/mechanic/active-job';
import { AdminDashboard } from '@/screens/admin/dashboard';
import {
  AdminLiveJobs,
  AdminMechanics,
  AdminPayments,
  AdminReports,
  AdminSettings,
  AdminUsers,
} from '@/screens/admin/screens';

type Screen =
  | 'home'
  | 'track'
  | 'history'
  | 'alerts'
  | 'profile'
  | 'request'
  | 'tracking'
  | 'earnings'
  | 'support'
  | 'users'
  | 'mechanics'
  | 'payments'
  | 'reports'
  | 'settings'
  | 'subscription';

const roles: Role[] = ['customer', 'mechanic', 'admin'];
const screens: Screen[] = [
  'home',
  'track',
  'history',
  'alerts',
  'profile',
  'request',
  'tracking',
  'earnings',
  'support',
  'users',
  'mechanics',
  'payments',
  'reports',
  'settings',
  'subscription',
];

function isRole(value: string | undefined): value is Role {
  return roles.includes(value as Role);
}

function isScreen(value: string | undefined): value is Screen {
  return screens.includes(value as Screen);
}

function ProtectedApp() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    const onUnverified = () => {
      if (location.pathname.startsWith('/auth/verify-email') || location.pathname === '/verify-email') {
        return;
      }
      navigate('/auth/verify-email', { replace: true });
    };
    const onSubscriptionRequired = () => {
      if (location.pathname.startsWith('/auth/complete-subscription')) return;
      navigate('/auth/complete-subscription', { replace: true });
    };
    window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, onUnverified);
    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, onSubscriptionRequired);
    return () => {
      window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, onUnverified);
      window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, onSubscriptionRequired);
    };
  }, [location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm font-semibold text-muted-foreground">Loading Road Rescue Ghana…</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={`/auth/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (user.role === 'customer' && !user.hasActiveSubscription) {
    return <Navigate to={`/auth/complete-subscription${location.search}`} replace />;
  }

  if (!user.emailVerified) {
    return <Navigate to="/auth/verify-email" replace />;
  }

  return <AppShell onLogout={() => void logout()} />;
}

function AppShell({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { role: roleParam, screen: screenParam, id: idParam } = useParams();
  const role: Role = isRole(roleParam) ? roleParam : user?.role ?? 'customer';
  const screen: Screen = isScreen(screenParam) ? screenParam : 'home';
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isRole(roleParam) || !isScreen(screenParam)) {
      navigate(`/${user?.role ?? 'customer'}/home`, { replace: true });
      return;
    }
    if (user && roleParam !== user.role) {
      navigate(`/${user.role}/home`, { replace: true });
      return;
    }
    if (roleParam === 'customer' && screenParam === 'mechanics' && !idParam) {
      navigate('/customer/home', { replace: true });
    }
  }, [idParam, navigate, roleParam, screenParam, user]);

  const handleNavigate = (id: string) => {
    if (isScreen(id)) {
      navigate(`/${role}/${id}`);
    }
  };

  const handleRequestHelp = (service?: ServiceType) => {
    navigate(service ? `/customer/request?service=${service}` : '/customer/request');
  };

  const handleRequestComplete = () => {
    navigate('/customer/tracking');
    toast({
      type: 'success',
      title: 'Rescue requested',
      description: 'Nearby mechanics can accept your request now.',
    });
  };

  const handleTrackingBack = () => {
    navigate(`/${role}/home`);
  };

  const handleAcceptJob = () => {
    navigate('/mechanic/track');
  };

  const handleOpenMechanicJob = () => {
    navigate('/mechanic/track');
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      home: role === 'customer' ? 'Road Rescue' : role === 'mechanic' ? 'Job Queue' : 'Dashboard',
      track: role === 'mechanic' ? 'Navigation' : 'Live Tracking',
      history: role === 'mechanic' ? 'Job History' : role === 'admin' ? 'Reports' : 'Service History',
      alerts: 'Notifications',
      profile: role === 'admin' ? 'Settings' : 'Profile',
      request: 'Request Assistance',
      tracking: 'Live Tracking',
      earnings: 'Payments & Earnings',
      support: 'Help & Support',
      users: 'User Management',
      mechanics: role === 'customer' ? 'Mechanic profile' : 'Mechanics',
      payments: 'Payments',
      reports: 'Reports',
      settings: 'Settings',
      subscription: 'Subscription',
    };
    return titles[screen] ?? 'Road Rescue';
  };

  if (screen === 'tracking' || (role === 'customer' && screen === 'track')) {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-background">
        <LiveTracking
          onBack={handleTrackingBack}
          onViewHistory={() => navigate('/customer/history')}
        />
      </div>
    );
  }

  if (role === 'mechanic' && screen === 'track') {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-background">
        <MechanicActiveJob onBack={() => navigate('/mechanic/home')} />
      </div>
    );
  }

  const isRequestFlow = screen === 'request';

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar
        role={role}
        active={screen}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
      />

      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        role={role}
        onNavigate={handleNavigate}
        active={screen}
      />

      <div className={cn('lg:pl-64 transition-all duration-300', sidebarCollapsed && 'lg:pl-[72px]')}>
        {!isRequestFlow && (
          <TopBar
            onOpenMenu={() => setMobileMenuOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            title={getPageTitle()}
            notificationCount={2}
            onOpenNotifications={() => setNotifOpen(true)}
          />
        )}

        <main
          className={cn(
            'mx-auto w-full max-w-5xl px-4 py-4 pb-nav',
            isRequestFlow ? 'pt-4' : 'pt-4',
            'lg:px-6 lg:py-6 lg:pb-6',
          )}
        >
          {role === 'customer' && screen === 'home' && (
            <CustomerHome
              onRequestHelp={handleRequestHelp}
              onSelectRequest={() => navigate('/customer/history')}
              onTrackRequest={() => navigate('/customer/tracking')}
              onOpenMechanic={(id) => navigate(`/customer/mechanics/${id}`)}
            />
          )}
          {role === 'customer' && screen === 'mechanics' && idParam && (
            <MechanicProfilePage mechanicId={idParam} />
          )}
          {role === 'customer' && screen === 'request' && (
            <RequestFlow
              onComplete={handleRequestComplete}
              onCancel={() => navigate('/customer/home')}
            />
          )}
          {role === 'customer' && screen === 'history' && (
            <ServiceHistory onSelectRequest={(req) => {
              if (['requested', 'accepted', 'enroute', 'arrived', 'inprogress', 'awaiting_confirmation', 'issue_reported'].includes(req.status)) {
                navigate('/customer/tracking');
                return;
              }
              navigate('/customer/history');
            }} />
          )}
          {role === 'customer' && screen === 'alerts' && <Notifications />}
          {role === 'customer' && screen === 'profile' && <Profile onSignOut={onLogout} />}
          {role === 'customer' && screen === 'subscription' && <CustomerSubscriptionPage />}
          {role === 'customer' && screen === 'support' && <HelpSupport />}

          {role === 'mechanic' && screen === 'home' && (
            <MechanicHome
              onAcceptJob={handleAcceptJob}
              onOpenJob={handleOpenMechanicJob}
            />
          )}
          {role === 'mechanic' && screen === 'history' && <MechanicJobHistory />}
          {role === 'mechanic' && screen === 'earnings' && <MechanicEarnings />}
          {role === 'mechanic' && screen === 'alerts' && <Notifications />}
          {role === 'mechanic' && screen === 'profile' && <Profile onSignOut={onLogout} />}
          {role === 'mechanic' && screen === 'support' && <HelpSupport />}

          {role === 'admin' && screen === 'home' && <AdminDashboard />}
          {role === 'admin' && screen === 'track' && <AdminLiveJobs />}
          {role === 'admin' && screen === 'users' && <AdminUsers />}
          {role === 'admin' && screen === 'mechanics' && <AdminMechanics />}
          {role === 'admin' && screen === 'payments' && <AdminPayments />}
          {role === 'admin' && (screen === 'reports' || screen === 'history') && <AdminReports />}
          {role === 'admin' && (screen === 'settings' || screen === 'profile') && (
            <AdminSettings onSignOut={onLogout} />
          )}
          {role === 'admin' && screen === 'alerts' && <Notifications />}
          {role === 'admin' && screen === 'support' && <HelpSupport />}
        </main>
      </div>

      {!isRequestFlow && (
        <MobileNav
          role={role}
          active={screen}
          onNavigate={handleNavigate}
          onEmergency={role === 'customer' ? handleRequestHelp : undefined}
        />
      )}

      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="top">
          <SheetHeader title="Search" onClose={() => setSearchOpen(false)} />
          <SheetBody>
            <SearchContent />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent>
          <SheetHeader
            title="Notifications"
            description="2 unread alerts"
            onClose={() => setNotifOpen(false)}
          />
          <SheetBody>
            <Notifications />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SearchContent() {
  const [query, setQuery] = React.useState('');
  const suggestions = [
    'Request towing',
    'Battery jump-start',
    'Flat tyre repair',
    'View service history',
    'Nearby mechanics',
    'Payment methods',
    'Emergency contacts',
  ];

  const filtered = query
    ? suggestions.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
    : suggestions;

  return (
    <div className="space-y-4">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search services, settings..."
        className="flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="space-y-1">
        {filtered.map((s) => (
          <button
            key={s}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent transition-colors text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return <ProtectedApp />;
}
