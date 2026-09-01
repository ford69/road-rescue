import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/logo';

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t-4 border-brand-blue bg-brand-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 lg:px-8 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-5">
            <Logo variant="dark" size="xl" to="/" className="max-w-[260px]" />
            <p className="max-w-md text-sm leading-relaxed text-white/70">
              Road Rescue connects drivers with trusted mechanics for emergency roadside assistance
              across Ghana. Professional service, clear communication, when you need us most.
            </p>
            <p className="text-sm font-semibold text-white">
              <a href="mailto:support@roadrescue4u.com" className="hover:text-brand-blue-light">
                support@roadrescue4u.com
              </a>
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/45">Services</p>
              <ul className="mt-4 space-y-2.5 text-sm text-white/75">
                <li><a href="#services" className="hover:text-white">Breakdown assistance</a></li>
                <li><a href="#services" className="hover:text-white">Battery jump start</a></li>
                <li><a href="#services" className="hover:text-white">Tire assistance</a></li>
                <li><a href="#services" className="hover:text-white">Towing & recovery</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/45">Company</p>
              <ul className="mt-4 space-y-2.5 text-sm text-white/75">
                <li><a href="#about" className="hover:text-white">About us</a></li>
                <li><a href="#how-it-works" className="hover:text-white">How it works</a></li>
                <li><a href="#contact" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/45">Account</p>
              <ul className="mt-4 space-y-2.5 text-sm text-white/75">
                <li><Link to="/auth/login" className="hover:text-white">Login</Link></li>
                <li><Link to="/auth/register" className="hover:text-white">Sign up</Link></li>
                <li><Link to="/auth/register?role=mechanic" className="hover:text-white">Become a mechanic</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Road Rescue Ghana. All rights reserved.</p>
          <p className="font-semibold text-brand-blue-light">24/7 Emergency Roadside Assistance</p>
        </div>
      </div>
    </footer>
  );
}
