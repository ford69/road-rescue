import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  CircleDot,
  Clock,
  Fuel,
  KeyRound,
  MapPin,
  Shield,
  Sparkles,
  Truck,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { useAuth } from '@/context/auth-context';
import { BRAND_ASSETS } from '@/lib/brand';
import { cn } from '@/lib/utils';

const services = [
  {
    icon: Truck,
    title: 'Towing',
    description: 'Safe vehicle recovery when you cannot drive.',
    accent: 'from-brand-blue/20 to-brand-blue/5',
    layout: 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
    featured: true,
  },
  {
    icon: CircleDot,
    title: 'Flat tyre',
    description: 'Tyre change or puncture repair on-site.',
    accent: 'from-primary/25 to-primary/5',
    layout: 'lg:col-span-1',
  },
  {
    icon: BatteryCharging,
    title: 'Battery',
    description: 'Jump-starts and battery assistance.',
    accent: 'from-success/20 to-success/5',
    layout: 'lg:col-span-1',
  },
  {
    icon: KeyRound,
    title: 'Lockout',
    description: 'Help when keys are locked inside.',
    accent: 'from-brand-navy/25 to-brand-navy/5',
    layout: 'lg:col-span-1',
  },
  {
    icon: Fuel,
    title: 'Fuel delivery',
    description: 'Emergency fuel when you run out.',
    accent: 'from-warning/25 to-warning/5',
    layout: 'lg:col-span-1',
  },
  {
    icon: AlertTriangle,
    title: 'Accident support',
    description: 'Rapid roadside response after incidents.',
    accent: 'from-critical/15 to-critical/5',
    layout: 'sm:col-span-2 lg:col-span-2',
  },
];

const steps = [
  {
    step: '01',
    title: 'Request help',
    description: 'Share your location and what went wrong — takes under a minute.',
    icon: Zap,
  },
  {
    step: '02',
    title: 'Get matched',
    description: 'A verified mechanic accepts your job and heads your way.',
    icon: Users,
  },
  {
    step: '03',
    title: 'Track & resolve',
    description: 'Follow live updates, pay securely, and get back on the road.',
    icon: MapPin,
  },
];

const plans = [
  {
    name: 'Free',
    price: 'GHS 0',
    period: '/month',
    detail: 'Core app access and standard matching.',
    features: ['Request roadside help', 'Live job tracking', 'Secure payments'],
    highlighted: false,
  },
  {
    name: 'Basic',
    price: 'Paid',
    period: ' monthly',
    detail: 'Member discounts and priority matching.',
    features: ['Priority dispatch', 'Member discounts', 'Email support'],
    highlighted: true,
  },
  {
    name: 'Premium',
    price: 'Paid',
    period: ' monthly',
    detail: 'Highest priority, larger discounts, and premium support.',
    features: ['Top priority matching', 'Largest discounts', 'Premium support'],
    highlighted: false,
  },
];

const trustPoints = [
  {
    icon: Shield,
    title: 'Verified providers',
    description: 'Mechanics go through verification before accepting jobs.',
  },
  {
    icon: MapPin,
    title: 'Live tracking',
    description: 'Customers can follow their rescue in real time.',
  },
  {
    icon: Wrench,
    title: 'Professional support',
    description: 'Help is available when you need it on the road.',
  },
];

const heroStats = [
  { value: '24/7', label: 'Always on call' },
  { value: '6+', label: 'Service types' },
  { value: '100%', label: 'Verified payouts' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(`/${user.role}/home`, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, user]);

  const requestHelp = () => {
    if (isAuthenticated && user?.role === 'customer') {
      navigate('/customer/request');
      return;
    }
    navigate('/auth/register');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm font-semibold text-muted-foreground">Loading Road Rescue Ghana…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav onRequestHelp={requestHelp} />

      <main>
        {/* Hero */}
        <section
          id="home"
          className="relative flex min-h-[100svh] items-center overflow-hidden"
        >
          <img
            src={BRAND_ASSETS.heroImage}
            alt=""
            className="absolute inset-0 h-full w-full scale-105 object-cover object-[70%_center] lg:object-center"
            fetchPriority="high"
            aria-hidden="true"
          />

          {/* Layered overlays */}
          <div className="hero-overlay-base" aria-hidden="true" />
          <div className="hero-overlay-gradient" aria-hidden="true" />
          <div className="hero-overlay-vignette" aria-hidden="true" />
          <div className="hero-overlay-noise" aria-hidden="true" />

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-36 lg:px-8 lg:pb-24 lg:pt-44">
            <div className="grid items-end gap-12 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Ghana&apos;s trusted roadside network
                </div>
                <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                  Need help
                  <span className="block text-primary">on the road?</span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80 sm:text-xl">
                  Get reliable roadside assistance from verified mechanics — fast dispatch,
                  live tracking, and secure payments when you need it most.
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    variant="primary"
                    size="lg"
                    className="min-h-12 gap-2 bg-primary text-primary-foreground shadow-[0_8px_32px_-8px_rgba(255,204,0,0.6)] hover:bg-primary-600"
                    onClick={requestHelp}
                  >
                    Request Roadside Assistance
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-h-12 border-white/40 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 hover:text-white"
                    onClick={() => navigate('/auth/register')}
                  >
                    Get Started
                  </Button>
                </div>
                <p className="mt-6 text-sm text-white/60">
                  Already registered?{' '}
                  <button
                    type="button"
                    className="font-semibold text-white underline underline-offset-4 transition-colors hover:text-primary"
                    onClick={() => navigate('/auth/login')}
                  >
                    Login
                  </button>
                </p>
              </div>

              <div className="lg:col-span-5">
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {heroStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-white/15 bg-white/10 p-4 text-center backdrop-blur-md sm:p-5"
                    >
                      <p className="font-display text-2xl font-bold text-white sm:text-3xl">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-white/65 sm:text-xs">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />
        </section>

        {/* Services — bento grid */}
        <Section
          id="services"
          eyebrow="What we offer"
          title="Complete roadside coverage"
          description="From flat tyres to accident support — verified mechanics for every common emergency."
          variant="muted"
        >
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {services.map((service) => (
              <ServiceCard
                key={service.title}
                icon={service.icon}
                title={service.title}
                description={service.description}
                accent={service.accent}
                className={service.layout}
                featured={service.featured}
              />
            ))}
          </div>
        </Section>

        {/* How it works — horizontal steps */}
        <Section
          id="how-it-works"
          eyebrow="Simple process"
          title="Help in three steps"
          description="Membership plans offer discounts and priority matching. Roadside services are paid per request."
        >
          <div className="grid gap-5 lg:grid-cols-3">
            {steps.map((item, index) => (
              <div key={item.step} className="relative">
                {index < steps.length - 1 && (
                  <div
                    className="absolute left-[calc(50%+2rem)] top-12 hidden h-px w-[calc(100%-4rem)] bg-gradient-to-r from-brand-blue/40 to-transparent lg:block"
                    aria-hidden="true"
                  />
                )}
                <div className="marketing-card group h-full p-6 lg:p-7">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-4xl font-bold text-brand-blue/15">
                      {item.step}
                    </span>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-soft transition-transform group-hover:scale-105">
                      <item.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.name} {...plan} />
            ))}
          </div>
        </Section>

        {/* Providers */}
        <Section
          id="about"
          eyebrow="For mechanics"
          title="Grow your rescue business"
          description="Earn from completed rescues with transparent payment records and Paystack settlement."
          variant="dark"
        >
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="marketing-card-dark lg:col-span-3 p-8 lg:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold text-white">
                Payments & earnings
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">
                View total earnings, payment status, and settlement status. Road Rescue records
                transactions — it does not hold a provider wallet balance.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Transparent per-job payment records',
                  'Paystack settlement directly to you',
                  'No custodial wallet on our platform',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/80">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-5 lg:col-span-2">
              <div className="marketing-card-dark flex-1 p-6">
                <MapPin className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-display text-lg font-bold text-white">Manage payouts</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  When your Paystack payment account is configured, manage payouts through the
                  payment provider directly.
                </p>
              </div>
              <div className="marketing-card-dark flex-1 p-6">
                <Clock className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-display text-lg font-bold text-white">Flexible schedule</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Accept jobs when you&apos;re available and build your reputation with every rescue.
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => navigate('/auth/register?role=mechanic')}
              >
                Become a provider
              </Button>
            </div>
          </div>
        </Section>

        {/* Payments */}
        <Section
          id="payments"
          eyebrow="Secure transactions"
          title="Payments you can trust"
          description="Customer payments and provider settlements are separate from membership subscriptions."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Webhook verified',
                text: 'Customer service payments are verified through Paystack webhooks — never from the browser alone.',
              },
              {
                title: 'No custodial wallet',
                text: 'Provider amounts are recorded as entitlements from each transaction, not as a Road Rescue wallet.',
              },
              {
                title: 'Separate billing',
                text: 'Membership subscriptions (Free, Basic, Premium) are billed separately from per-service payments.',
              },
            ].map((item) => (
              <div key={item.title} className="marketing-card border-t-4 border-t-primary p-6">
                <h3 className="font-display text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Safety */}
        <Section
          id="safety"
          eyebrow="Peace of mind"
          title="Safety & trust"
          description="Verified providers, live tracking, and secure payments."
          variant="muted"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {trustPoints.map((point, index) => (
              <div
                key={point.title}
                className="marketing-card group overflow-hidden p-0"
              >
                <div
                  className={cn(
                    'h-1.5 w-full',
                    index === 0 && 'bg-brand-blue',
                    index === 1 && 'bg-primary',
                    index === 2 && 'bg-success',
                  )}
                />
                <div className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue transition-colors group-hover:bg-brand-blue group-hover:text-white">
                    <point.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {point.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Support CTA */}
        <Section
          id="support"
          eyebrow="We're here"
          title="Help & support"
          description="Questions about a rescue, payment, or your account?"
          className="pb-20"
        >
          <div className="relative overflow-hidden rounded-3xl border border-brand-blue/20 bg-gradient-to-br from-brand-blue via-brand-navy to-brand-black p-8 sm:p-10">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/5 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="font-display text-2xl font-bold text-white">Need assistance?</p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Sign in to contact support from your profile, or email{' '}
                  <a
                    href="mailto:support@roadrescue4u.com"
                    className="font-semibold text-primary hover:underline"
                  >
                    support@roadrescue4u.com
                  </a>
                  .
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="shrink-0"
                onClick={() => navigate('/auth/login')}
              >
                Sign in for support
              </Button>
            </div>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  variant = 'default',
  className,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  variant?: 'default' | 'muted' | 'dark';
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'border-b border-border',
        variant === 'muted' && 'bg-muted/40',
        variant === 'dark' && 'bg-brand-black text-white',
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        <div className="mb-10 max-w-2xl">
          {eyebrow && (
            <p
              className={cn(
                'text-xs font-bold uppercase tracking-[0.2em]',
                variant === 'dark' ? 'text-primary' : 'text-brand-blue',
              )}
            >
              {eyebrow}
            </p>
          )}
          <h2
            className={cn(
              'font-display text-3xl font-bold tracking-tight sm:text-4xl',
              variant === 'dark' ? 'text-white' : 'text-foreground',
            )}
          >
            {title}
          </h2>
          <p
            className={cn(
              'mt-3 text-base leading-relaxed',
              variant === 'dark' ? 'text-white/65' : 'text-muted-foreground',
            )}
          >
            {description}
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}

function ServiceCard({
  icon: Icon,
  title,
  description,
  accent,
  className,
  featured,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string;
  className?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        'marketing-card group relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated',
        featured && 'flex flex-col justify-between p-8 lg:min-h-[280px]',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-100',
          accent,
        )}
        aria-hidden="true"
      />
      <div className="relative">
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl bg-white shadow-soft',
            featured ? 'h-14 w-14' : 'h-11 w-11',
          )}
        >
          <Icon className={cn('text-brand-blue', featured ? 'h-7 w-7' : 'h-5 w-5')} />
        </div>
        <h3 className={cn('mt-5 font-display font-bold', featured ? 'text-2xl' : 'text-lg')}>
          {title}
        </h3>
        <p
          className={cn(
            'mt-2 leading-relaxed text-muted-foreground',
            featured ? 'max-w-md text-base' : 'text-sm',
          )}
        >
          {description}
        </p>
        {featured && (
          <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue">
            Most requested service
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </p>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  detail,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  period: string;
  detail: string;
  features: string[];
  highlighted: boolean;
}) {
  return (
    <div
      className={cn(
        'marketing-card relative flex h-full flex-col p-6 lg:p-7',
        highlighted && 'border-brand-blue shadow-elevated ring-2 ring-brand-blue/20 lg:-mt-2 lg:mb-2',
      )}
    >
      {highlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-blue px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Popular
        </span>
      )}
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">{name}</p>
      <p className="mt-2 font-display text-3xl font-bold">
        {price}
        <span className="text-base font-medium text-muted-foreground">{period}</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
