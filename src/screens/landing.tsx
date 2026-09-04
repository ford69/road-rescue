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
import { BRAND_ASSETS, MARKETING_IMAGES, SERVICE_IMAGES } from '@/lib/brand';
import { cn } from '@/lib/utils';

const services = [
  {
    icon: Truck,
    title: 'Towing',
    description: 'Safe vehicle recovery when you cannot drive.',
    accent: 'from-brand-blue/20 to-brand-blue/5',
    layout: 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
    featured: true,
    image: SERVICE_IMAGES.towing,
  },
  {
    icon: CircleDot,
    title: 'Flat tyre',
    description: 'Tyre change or puncture repair on-site.',
    accent: 'from-primary/25 to-primary/5',
    layout: 'lg:col-span-1',
    image: SERVICE_IMAGES.flatTyre,
  },
  {
    icon: BatteryCharging,
    title: 'Battery',
    description: 'Jump-starts and battery assistance.',
    accent: 'from-success/20 to-success/5',
    layout: 'lg:col-span-1',
    image: SERVICE_IMAGES.battery,
  },
  {
    icon: KeyRound,
    title: 'Lockout',
    description: 'Help when keys are locked inside.',
    accent: 'from-brand-navy/25 to-brand-navy/5',
    layout: 'lg:col-span-1',
    image: SERVICE_IMAGES.lockout,
  },
  {
    icon: Fuel,
    title: 'Fuel delivery',
    description: 'Emergency fuel when you run out.',
    accent: 'from-warning/25 to-warning/5',
    layout: 'lg:col-span-1',
    image: SERVICE_IMAGES.fuelDelivery,
  },
  {
    icon: AlertTriangle,
    title: 'Accident support',
    description: 'Rapid roadside response after incidents.',
    accent: 'from-critical/15 to-critical/5',
    layout: 'sm:col-span-2 lg:col-span-2',
    image: SERVICE_IMAGES.accidentSupport,
  },
];

const steps = [
  {
    step: '01',
    title: 'Request help',
    description: 'Open the app, share your location, and pick the service you need.',
    icon: Zap,
  },
  {
    step: '02',
    title: 'Get matched',
    description: 'A nearby verified mechanic accepts your job and drives to you.',
    icon: Users,
  },
  {
    step: '03',
    title: 'Track & resolve',
    description: 'Follow live updates on the map until your rescue is complete.',
    icon: MapPin,
  },
];

const plans = [
  {
    name: 'Free',
    price: 'GHS 0',
    period: '/month',
    detail: 'Core app access and standard matching.',
    features: ['Request roadside help', 'Live job tracking', 'In-app support'],
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
    description: 'Every mechanic is checked before they can accept your job.',
    image: SERVICE_IMAGES.lockout,
  },
  {
    icon: MapPin,
    title: 'Live tracking',
    description: 'See exactly where help is and when it will arrive.',
    image: SERVICE_IMAGES.accidentSupport,
  },
  {
    icon: Wrench,
    title: 'Professional support',
    description: 'Our team is available if you need help during a rescue.',
    image: SERVICE_IMAGES.battery,
  },
];

const galleryImages = [
  { ...SERVICE_IMAGES.accidentSupport, label: 'Accident support', span: 'lg:col-span-2 lg:row-span-2' },
  { ...SERVICE_IMAGES.towing, label: 'Heavy recovery', span: 'lg:col-span-1' },
  { ...SERVICE_IMAGES.battery, label: 'Battery assistance', span: 'lg:col-span-1' },
  { ...SERVICE_IMAGES.lockout, label: 'Lockout help', span: 'lg:col-span-2' },
  { ...SERVICE_IMAGES.flatTyre, label: 'Flat tyre repair', span: 'lg:col-span-2' },
];

const heroStats = [
  { value: '24/7', label: 'Always on call' },
  { value: '6+', label: 'Service types' },
  { value: '100%', label: 'Verified mechanics' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(user.emailVerified ? `/${user.role}/home` : '/auth/verify-email', { replace: true });
    }
  }, [isAuthenticated, loading, navigate, user]);

  const goToLogin = () => navigate('/auth/login');

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <SiteNav onRequestHelp={requestHelp} />

      <main id="main-content">
        {/* Hero */}
        <section
          id="home"
          className="landing-section-anchor relative flex min-h-[100svh] items-center overflow-hidden"
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

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 pt-36 lg:px-8 lg:pb-28 lg:pt-44">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Ghana&apos;s trusted roadside network
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
                Stranded on the road?
                <span className="block text-primary">Help is one tap away.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white sm:text-xl">
                Request a verified mechanic in under a minute. Track them live
                and get moving again — available 24/7 across Ghana.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  variant="primary"
                  size="lg"
                  className="min-h-[3.25rem] gap-2 bg-primary text-primary-foreground shadow-[0_8px_32px_-8px_rgba(255,204,0,0.6)] hover:bg-primary-600"
                  onClick={requestHelp}
                >
                  Get help now
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="min-h-[3.25rem] border-white/40 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 hover:text-white"
                  onClick={() => navigate('/auth/register')}
                >
                  Create free account
                </Button>
              </div>
              <p className="mt-6 text-sm text-white/70">
                Already have an account?{' '}
                <button
                  type="button"
                  className="font-semibold text-white underline underline-offset-4 transition-colors hover:text-primary"
                  onClick={() => navigate('/auth/login')}
                >
                  Sign in
                </button>
              </p>

              <div className="mt-10 grid grid-cols-3 gap-3 sm:max-w-lg sm:gap-4">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/15 bg-white/10 px-3 py-4 text-center backdrop-blur-md sm:px-4 sm:py-5"
                  >
                    <p className="font-display text-xl font-bold text-white sm:text-2xl">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 sm:text-xs">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />
        </section>

        {/* Full-bleed image strip */}
        <section className="relative h-56 overflow-hidden sm:h-72 lg:h-80" aria-label="Road Rescue in action">
          <MarketingPhoto
            src={MARKETING_IMAGES.onTheGround.src}
            position={MARKETING_IMAGES.onTheGround.position}
            overlay="blue"
            className="h-full w-full"
          />
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">On the ground</p>
              <p className="mt-2 font-display text-2xl font-bold text-white sm:text-4xl">
                Real help. Real mechanics. Right when you need it.
              </p>
            </div>
          </div>
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
                image={service.image}
                onSelect={goToLogin}
              />
            ))}
          </div>
          <p className="mt-6 text-center text-sm font-medium text-foreground/80">
            Tap any service to sign in and request help.
          </p>
        </Section>

        {/* How it works — horizontal steps */}
        <Section
          id="how-it-works"
          eyebrow="Simple process"
          title="Help in three steps"
          description="No complicated forms. Request help, get matched, and track your rescue — most jobs start in minutes."
        >
          <div className="grid items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="relative lg:col-span-5">
              <MarketingPhoto
                src={MARKETING_IMAGES.accraRoadNight.src}
                position={MARKETING_IMAGES.accraRoadNight.position}
                overlay="dark"
                className="h-full min-h-[320px] rounded-3xl border border-border shadow-elevated lg:min-h-[480px]"
              />
            </div>

            <div className="grid gap-5 lg:col-span-7">
              {steps.map((item, index) => (
                <div key={item.step} className="relative">
                  {index < steps.length - 1 && (
                    <div
                      className="absolute left-6 top-16 hidden h-[calc(100%-2rem)] w-px bg-gradient-to-b from-brand-blue/40 to-transparent lg:block"
                      aria-hidden="true"
                    />
                  )}
                  <div className="marketing-card group flex gap-5 p-5 lg:p-6">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft transition-transform group-hover:scale-105">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-display text-sm font-bold text-primary-700">
                        Step {item.step}
                      </span>
                      <h3 className="mt-1 font-display text-xl font-bold text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/75">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.name}
                {...plan}
                onChoose={() => navigate('/auth/register')}
              />
            ))}
          </div>
          <p className="mt-6 text-center text-sm font-medium text-foreground/80">
            Membership is optional — you can still request roadside help on the free plan.
          </p>
        </Section>

        {/* Gallery */}
        <Section
          id="gallery"
          eyebrow="In action"
          title="Rescue moments"
          description="Professional roadside support — day or night, across Ghana."
          variant="muted"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[180px]">
            {galleryImages.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-border shadow-card',
                  item.span,
                )}
              >
                <MarketingPhoto
                  src={item.src}
                  position={item.position}
                  overlay="dark"
                  className="h-full min-h-[160px] w-full transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-black/90 to-transparent p-4 pt-12">
                  <p className="font-display text-sm font-bold text-white">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Providers */}
        <Section
          id="about"
          eyebrow="For mechanics"
          title="Grow your rescue business"
          description="Connect with drivers who need help. Accept jobs on your schedule and build your reputation with every rescue."
          variant="dark"
          background={
            <MarketingPhoto
              src={SERVICE_IMAGES.towing.src}
              position={SERVICE_IMAGES.towing.position}
              overlay="blue"
              className="pointer-events-none absolute inset-0 opacity-50"
            />
          }
        >
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="marketing-card-dark lg:col-span-3 p-8 lg:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold text-white">
                More jobs, less hassle
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/85">
                Road Rescue helps verified mechanics find customers faster. Focus on the rescue —
                we handle matching, notifications, and job coordination in the app.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Receive nearby job requests in real time',
                  'Build your profile with ratings and completed jobs',
                  'Work when it suits your schedule',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/90">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-5 lg:col-span-2">
              <div className="marketing-card-dark flex-1 p-6">
                <MapPin className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-display text-lg font-bold text-white">Local coverage</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85">
                  Get matched with customers near you and navigate straight to the breakdown location.
                </p>
              </div>
              <div className="marketing-card-dark flex-1 p-6">
                <Clock className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-display text-lg font-bold text-white">Flexible schedule</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85">
                  Go online when you are available and accept only the jobs that work for you.
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

        {/* Why Road Rescue */}
        <Section
          id="payments"
          eyebrow="Why choose us"
          title="Built for drivers and mechanics"
          description="Road Rescue connects people who need help with professionals who can deliver it — simply and reliably."
        >
          <div className="grid items-stretch gap-8 lg:grid-cols-2">
            <MarketingPhoto
              src={MARKETING_IMAGES.onTheGround.src}
              position={MARKETING_IMAGES.onTheGround.position}
              overlay="dark"
              className="min-h-[260px] rounded-3xl border border-border shadow-elevated lg:min-h-full"
            />
            <div className="grid gap-4">
              {[
                {
                  title: 'Fast matching',
                  text: 'Share your location and get connected to a verified mechanic without long phone calls.',
                },
                {
                  title: 'Live tracking',
                  text: 'See when help is on the way and follow progress from request to completion.',
                },
                {
                  title: 'Membership perks',
                  text: 'Optional plans add priority matching and support — roadside help is always available on Free.',
                },
              ].map((item) => (
                <div key={item.title} className="marketing-card border-l-4 border-l-primary p-6">
                  <h3 className="font-display text-lg font-bold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/75">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Safety */}
        <Section
          id="safety"
          eyebrow="Peace of mind"
          title="Safety & trust"
          description="Verified providers, live tracking, and responsive support when you need it."
          variant="muted"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {trustPoints.map((point, index) => (
              <div
                key={point.title}
                className="marketing-card group overflow-hidden p-0"
              >
                <MarketingPhoto
                  src={point.image.src}
                  position={point.image.position}
                  overlay="blue"
                  className="h-44 w-full transition-transform duration-500 group-hover:scale-105"
                />
                <div className="p-6">
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                      index === 0 && 'bg-primary/15 text-primary-700 group-hover:bg-primary group-hover:text-primary-foreground',
                      index === 1 && 'bg-primary/15 text-primary-700 group-hover:bg-primary group-hover:text-primary-foreground',
                      index === 2 && 'bg-primary/15 text-primary-700 group-hover:bg-primary group-hover:text-primary-foreground',
                    )}
                  >
                    <point.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/75">
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
          description="Questions about a rescue or your account? We are here to help."
          className="pb-20"
        >
          <div className="relative overflow-hidden rounded-3xl border border-brand-blue/20 p-8 sm:p-10">
            <MarketingPhoto
              src={SERVICE_IMAGES.accidentSupport.src}
              position={SERVICE_IMAGES.accidentSupport.position}
              overlay="blue"
              className="absolute inset-0"
            />
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

      {/* Mobile sticky help bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 shadow-elevated backdrop-blur-md safe-bottom lg:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button variant="outline" className="flex-1 min-h-11" onClick={() => navigate('/auth/login')}>
            Sign in
          </Button>
          <Button variant="primary" className="flex-[2] min-h-11" onClick={requestHelp}>
            Get help now
          </Button>
        </div>
      </div>

      <div className="h-20 lg:hidden" aria-hidden="true" />

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
  background,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  variant?: 'default' | 'muted' | 'dark';
  className?: string;
  background?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        'landing-section-anchor relative border-b border-border overflow-hidden',
        variant === 'muted' && 'bg-muted/40',
        variant === 'dark' && 'bg-brand-black text-white',
        className,
      )}
    >
      {background}
      <div className="relative mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        <div className="mb-10 max-w-2xl">
          {eyebrow && (
            <p
              className={cn(
                'text-xs font-bold uppercase tracking-[0.12em]',
                variant === 'dark' ? 'text-primary' : 'text-primary-700',
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
              variant === 'dark' ? 'text-white/85' : 'text-foreground/75',
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

function MarketingPhoto({
  src,
  position = 'center',
  alt = '',
  className,
  overlay = 'dark',
}: {
  src: string;
  position?: string;
  alt?: string;
  className?: string;
  overlay?: 'dark' | 'light' | 'blue' | 'none';
}) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: position }}
        loading="lazy"
        decoding="async"
      />
      {overlay !== 'none' && (
        <div
          className={cn(
            'absolute inset-0',
            overlay === 'dark' && 'bg-brand-black/50',
            overlay === 'light' && 'bg-white/25',
            overlay === 'blue' && 'bg-brand-blue/55',
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function ServiceCard({
  icon: Icon,
  title,
  description,
  accent,
  className,
  featured,
  image,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string;
  className?: string;
  featured?: boolean;
  image?: { src: string; position: string };
  onSelect?: () => void;
}) {
  const Component = onSelect ? 'button' : 'div';

  return (
    <Component
      type={onSelect ? 'button' : undefined}
      onClick={onSelect}
      className={cn(
        'marketing-card group relative w-full overflow-hidden text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue',
        featured && 'flex flex-col justify-end p-0 lg:min-h-[300px]',
        !featured && image && 'p-0',
        onSelect && 'cursor-pointer',
        className,
      )}
      aria-label={onSelect ? `Request ${title} assistance` : undefined}
    >
      {image && (
        <MarketingPhoto
          src={image.src}
          position={image.position}
          overlay={featured ? 'blue' : 'dark'}
          className={cn(
            'absolute inset-0 transition-transform duration-500 group-hover:scale-105',
            featured ? 'opacity-90' : 'opacity-100',
          )}
        />
      )}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-80',
          accent,
          image && 'from-brand-black/80 via-brand-black/50 to-transparent opacity-100',
        )}
        aria-hidden="true"
      />
      <div className={cn('relative', (featured || image) && 'p-6 lg:p-8', image && !featured && 'mt-24')}>
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl shadow-soft',
            featured || image ? 'bg-white/95' : 'bg-white',
            featured ? 'h-14 w-14' : 'h-11 w-11',
          )}
        >
          <Icon className={cn('text-primary-700', featured ? 'h-7 w-7' : 'h-5 w-5')} />
        </div>
        <h3
          className={cn(
            'mt-5 font-display font-bold',
            featured || image ? 'text-white' : '',
            featured ? 'text-2xl' : 'text-lg',
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'mt-2 leading-relaxed',
            featured || image ? 'text-white/95' : 'text-muted-foreground',
            featured ? 'max-w-md text-base' : 'text-sm',
          )}
        >
          {description}
        </p>
        {featured && (
          <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            Tap to request help
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </p>
        )}
      </div>
    </Component>
  );
}

function PlanCard({
  name,
  price,
  period,
  detail,
  features,
  highlighted,
  onChoose,
}: {
  name: string;
  price: string;
  period: string;
  detail: string;
  features: string[];
  highlighted: boolean;
  onChoose?: () => void;
}) {
  return (
    <div
      className={cn(
        'marketing-card relative flex h-full flex-col p-6 lg:p-7',
        highlighted && 'border-primary shadow-elevated ring-2 ring-primary/25 lg:-mt-2 lg:mb-2',
      )}
    >
      {highlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          Popular
        </span>
      )}
      <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">{name}</p>
      <p className="mt-2 font-display text-3xl font-bold">
        {price}
        <span className="text-base font-medium text-foreground/70">{period}</span>
      </p>
      <p className="mt-2 text-sm text-foreground/75">{detail}</p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      {onChoose && (
        <Button
          variant={highlighted ? 'primary' : 'outline'}
          className="mt-6 w-full min-h-11"
          onClick={onChoose}
        >
          {name === 'Free' ? 'Start for free' : `Choose ${name}`}
        </Button>
      )}
    </div>
  );
}
