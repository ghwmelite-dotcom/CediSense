import { useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

/* ─── Scroll-reveal hook ─────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    const children = el.querySelectorAll('.reveal-on-scroll');
    children.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ─── Feature data ───────────────────────────────────────── */
const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-1.5L12 12m0 0l3-1.5M12 12l-3-1.5" />
      </svg>
    ),
    title: 'Track Everything',
    description: 'SMS import, CSV upload, and manual entry across 11 providers. Every cedi accounted for.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    title: 'AI Advisor',
    description: 'Streaming chat powered by Qwen3-30B. Understands MoMo fees, susu culture, and local finance.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Smart Dashboard',
    description: 'Daily trends, category breakdowns, and month-over-month insights at a glance.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Budgets & Goals',
    description: 'Monthly category limits and savings goals with visual progress tracking.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
    title: 'Bill Reminders',
    description: 'Auto-detect recurring payments. Never miss ECG, water, rent, or subscription dues.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    title: 'Works Offline',
    description: 'Full offline support. Sync when connected. Installable as a PWA on any device.',
  },
];

/* ─── Provider data ──────────────────────────────────────── */
const providers = [
  'MTN MoMo',
  'Vodafone Cash',
  'AirtelTigo',
  'GCB Bank',
  'Ecobank',
  'Fidelity Bank',
  'Stanbic Bank',
  'Absa Bank',
];

/* ─── Steps data ─────────────────────────────────────────── */
const steps = [
  {
    number: '1',
    title: 'Create your account',
    description: 'Phone number + 4-digit PIN. No email needed, no hassle.',
  },
  {
    number: '2',
    title: 'Import your transactions',
    description: 'Paste your MoMo SMS messages or upload a CSV file.',
  },
  {
    number: '3',
    title: 'Get AI-powered insights',
    description: 'Budget smarter, save more, and grow your wealth with AI.',
  },
];

/* ─── Pricing features ───────────────────────────────────── */
const pricingFeatures = [
  'Unlimited transactions',
  'AI chat advisor (40/day)',
  '11 provider SMS parsing',
  'Budgets & savings goals',
  'Offline support',
  'Bill reminders',
];

/* ═══════════════════════════════════════════════════════════ */
/*  LANDING PAGE COMPONENT                                    */
/* ═══════════════════════════════════════════════════════════ */
export function LandingPage() {
  const featuresRef = useScrollReveal();
  const providersRef = useScrollReveal();
  const stepsRef = useScrollReveal();
  const pricingRef = useScrollReveal();

  const scrollToFeatures = useCallback(() => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-ghana-dark text-white overflow-x-hidden">
      {/* ─── Background gradients (fixed) ───────────────── */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(212,168,67,0.07) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 85% 90%, rgba(0,107,63,0.06) 0%, transparent 55%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 40% 30% at 50% 50%, rgba(212,168,67,0.02) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ─── Sticky nav ─────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04]"
        style={{
          backdropFilter: 'blur(16px) saturate(150%)',
          WebkitBackdropFilter: 'blur(16px) saturate(150%)',
          background: 'rgba(13,13,18,0.75)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-gold font-extrabold text-2xl leading-none">₵</span>
            <span className="text-white font-semibold text-lg tracking-tight">CediSense</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-200 px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn-gold text-sm px-5 py-2.5 hidden sm:inline-flex"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  HERO SECTION                                      */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-16">
        <div className="text-center max-w-3xl mx-auto motion-safe:animate-slide-up">
          {/* Brand mark with glow */}
          <div className="relative inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-3xl mb-8">
            <div className="absolute inset-0 rounded-3xl bg-gold/10 blur-2xl scale-[2] motion-safe:animate-glow-pulse" />
            <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 flex items-center justify-center shadow-gold-glow-lg">
              <span className="text-gold font-extrabold text-5xl sm:text-6xl leading-none">₵</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
              Smart Money
            </span>
            <br />
            <span className="bg-gradient-to-r from-gold via-gold to-gold/70 bg-clip-text text-transparent">
              for Ghana
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted max-w-xl mx-auto leading-relaxed mb-10">
            AI-powered personal finance. Track Mobile Money, budget smarter, grow your savings.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="btn-gold text-base px-8 py-3.5 w-full sm:w-auto text-center"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="relative w-full sm:w-auto text-center px-8 py-3.5 rounded-xl text-base font-semibold text-white/80 border border-white/[0.08] hover:border-white/[0.15] hover:text-white hover:bg-white/[0.04] transition-all duration-200 active:scale-[0.98]"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={scrollToFeatures}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted/50 hover:text-muted transition-colors duration-300 group"
          aria-label="Scroll to features"
        >
          <span className="text-xs tracking-wider uppercase">Explore</span>
          <svg
            className="w-5 h-5 motion-safe:animate-bounce"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  FEATURES SECTION                                  */}
      {/* ═══════════════════════════════════════════════════ */}
      <section id="features" className="relative py-24 sm:py-32 px-4 sm:px-6" ref={featuresRef}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Everything you need
            </h2>
            <p className="text-muted text-lg max-w-md mx-auto">
              Built for how Ghanaians actually manage money.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="glass-card rounded-2xl p-6 sm:p-7 h-full card-interactive group">
                  <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/10 flex items-center justify-center text-gold mb-5 group-hover:bg-gold/15 group-hover:border-gold/20 transition-all duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  PROVIDERS SECTION                                 */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-24 px-4 sm:px-6" ref={providersRef}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              Connects with your providers
            </h2>
            <p className="text-muted text-base">
              Mobile Money and bank transaction parsing built in.
            </p>
          </div>

          <div className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0 delay-100">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:gap-x-12 sm:gap-y-6">
              {providers.map((provider) => (
                <div
                  key={provider}
                  className="flex items-center gap-2.5 text-white/30 hover:text-white/50 transition-colors duration-300"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <span className="text-xs font-bold">{provider.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap">{provider}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  HOW IT WORKS SECTION                              */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6" ref={stepsRef}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Get started in 3 steps
            </h2>
            <p className="text-muted text-lg max-w-md mx-auto">
              From download to insights in under two minutes.
            </p>
          </div>

          <div className="relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-gradient-to-r from-gold/30 via-ghana-green/30 to-gold/30" aria-hidden="true" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
              {steps.map((step, i) => (
                <div
                  key={step.number}
                  className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0 text-center"
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  {/* Number circle */}
                  <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-full mb-5">
                    <div className="absolute inset-0 rounded-full bg-gold/10 blur-lg scale-150" />
                    <div className="relative w-full h-full rounded-full bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 flex items-center justify-center">
                      <span className="text-gold font-bold text-lg">{step.number}</span>
                    </div>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed max-w-xs mx-auto">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  PRICING SECTION                                   */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6" ref={pricingRef}>
        <div className="max-w-lg mx-auto text-center">
          <div className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Free to start
            </h2>
            <p className="text-muted text-lg mb-12">
              No credit card. No hidden fees. Just smarter money.
            </p>
          </div>

          <div className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0 delay-100">
            <div className="glass-card rounded-2xl p-8 sm:p-10 text-left">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-extrabold text-white">Free</span>
                <span className="text-muted text-sm">forever</span>
              </div>
              <p className="text-muted text-sm mb-8">Everything you need to take control.</p>

              <ul className="space-y-4 mb-10">
                {pricingFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-white/90 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className="btn-gold w-full text-center block py-3.5 text-base"
              >
                Get Started Free
              </Link>
            </div>

            <p className="text-muted/50 text-sm mt-6">
              Plus and Pro plans coming soon.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  FOOTER                                            */}
      {/* ═══════════════════════════════════════════════════ */}
      <footer className="relative border-t border-white/[0.04] py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <span className="text-gold font-extrabold text-xl leading-none">₵</span>
            <span className="text-white font-semibold tracking-tight">CediSense</span>
          </div>
          <p className="text-muted/50 text-sm mb-4">Built by Hodges &amp; Co.</p>
          <div className="flex items-center justify-center gap-6 mb-6">
            <a href="#" className="text-muted/40 hover:text-muted text-sm transition-colors duration-200">Privacy</a>
            <a href="#" className="text-muted/40 hover:text-muted text-sm transition-colors duration-200">Terms</a>
          </div>
          <p className="text-muted/30 text-xs tracking-wider">
            Made with care in Ghana
          </p>
        </div>
      </footer>
    </div>
  );
}
