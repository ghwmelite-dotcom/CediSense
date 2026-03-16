import { useEffect, useRef, useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';

/* ================================================================ */
/*  SCROLL REVEAL HOOK                                               */
/* ================================================================ */
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
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );

    const children = el.querySelectorAll('.reveal-on-scroll');
    children.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ================================================================ */
/*  ANIMATED COUNTER HOOK                                            */
/* ================================================================ */
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            const start = performance.now();
            const animate = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setValue(Math.round(eased * target));
              if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

/* ================================================================ */
/*  PHONE MOCKUP COMPONENT                                           */
/* ================================================================ */
function PhoneMockup() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative" aria-hidden="true">
      {/* Animated gold glow behind phone — pulses gently */}
      <div
        className="absolute inset-0 -m-12"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(212,168,67,0.18) 0%, rgba(212,168,67,0.06) 40%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'glowPulse 4s ease-in-out infinite',
        }}
      />

      {/* Orbiting ring */}
      <div
        className="absolute inset-0 -m-16 rounded-full border border-gold/[0.06]"
        style={{ animation: 'slowSpin 30s linear infinite' }}
      />
      <div
        className="absolute inset-0 -m-24 rounded-full border border-gold/[0.03]"
        style={{ animation: 'slowSpin 45s linear infinite reverse' }}
      />

      {/* Phone frame — entrance animation */}
      <div
        className="relative w-64 sm:w-72 h-[460px] sm:h-[520px] rounded-[2.5rem] border-4 border-white/[0.08] overflow-hidden transition-all duration-1000 ease-out"
        style={{
          background: '#14142A',
          boxShadow: '0 0 60px rgba(212,168,67,0.15), 0 0 120px rgba(212,168,67,0.05), 0 25px 50px rgba(0,0,0,0.5)',
          transform: loaded ? 'rotate(-3deg) translateY(0)' : 'rotate(-3deg) translateY(40px)',
          opacity: loaded ? 1 : 0,
        }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1">
          <span className="text-[10px] text-white/40 font-medium">9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-white/30" />
            <div className="w-1 h-1 rounded-full bg-white/30" />
            <div className="w-4 h-2 rounded-sm border border-white/30 relative">
              <div className="absolute inset-[1px] right-[3px] rounded-sm bg-income" />
            </div>
          </div>
        </div>

        {/* Notch */}
        <div className="mx-auto w-24 h-5 bg-black rounded-b-2xl -mt-0.5 mb-2" />

        {/* Content area — staggered entrance animations */}
        <div className="px-4 space-y-3">
          {/* Greeting */}
          <p
            className="text-white/50 text-xs font-medium transition-all duration-700 ease-out"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'translateY(0)' : 'translateY(10px)',
              transitionDelay: '600ms',
            }}
          >Good evening, Kofi</p>

          {/* Balance — the star of the show */}
          <div
            className="text-center py-2 transition-all duration-700 ease-out"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'translateY(0) scale(1)' : 'translateY(15px) scale(0.95)',
              transitionDelay: '800ms',
            }}
          >
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Total Balance</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-gold tracking-tight">
              &#x20B5;12,450<span className="text-lg">.00</span>
            </p>
          </div>

          {/* Income / Expense mini cards — staggered entrance */}
          <div
            className="grid grid-cols-2 gap-2 transition-all duration-700 ease-out"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'translateY(0)' : 'translateY(12px)',
              transitionDelay: '1000ms',
            }}
          >
            <div className="rounded-xl bg-income/10 p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <svg className="w-3 h-3 text-income" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-income text-[10px] font-semibold">Income</span>
              </div>
              <p className="text-white text-sm font-bold">&#x20B5;3,500</p>
            </div>
            <div className="rounded-xl bg-expense/10 p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <svg className="w-3 h-3 text-expense" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-expense text-[10px] font-semibold">Expenses</span>
              </div>
              <p className="text-white text-sm font-bold">&#x20B5;2,100</p>
            </div>
          </div>

          {/* Mini bar chart — bars grow on load */}
          <div
            className="rounded-xl bg-white/[0.03] p-3 transition-all duration-700 ease-out"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'translateY(0)' : 'translateY(12px)',
              transitionDelay: '1200ms',
            }}
          >
            <p className="text-white/40 text-[9px] uppercase tracking-wider mb-2">This Week</p>
            <div className="flex items-end gap-1.5 h-12">
              {[40, 65, 35, 80, 55, 70, 45].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${h}%`,
                    background: i === 3
                      ? 'linear-gradient(to top, #D4A843, #E8C873)'
                      : 'rgba(212,168,67,0.2)',
                    animation: `growBar 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms both`,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span key={i} className="text-[7px] text-white/25 flex-1 text-center">{d}</span>
              ))}
            </div>
          </div>

          {/* Transaction rows — slide in last */}
          <div
            className="space-y-2 transition-all duration-700 ease-out"
            style={{
              opacity: loaded ? 1 : 0,
              transform: loaded ? 'translateY(0)' : 'translateY(12px)',
              transitionDelay: '1400ms',
            }}
          >
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02]">
              <div className="w-7 h-7 rounded-lg bg-[#FFCC00]/15 flex items-center justify-center">
                <span className="text-[10px] font-bold text-[#FFCC00]">M</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-medium">MTN MoMo</p>
                <p className="text-white/30 text-[9px]">Transfer received</p>
              </div>
              <span className="text-income text-[11px] font-semibold">+&#x20B5;500</span>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02]">
              <div className="w-7 h-7 rounded-lg bg-expense/15 flex items-center justify-center">
                <span className="text-[10px]">&#x1F6D2;</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-medium">Melcom</p>
                <p className="text-white/30 text-[9px]">Shopping</p>
              </div>
              <span className="text-expense text-[11px] font-semibold">-&#x20B5;180</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  FLOATING CEDI PARTICLES                                          */
/* ================================================================ */
function FloatingParticles() {
  const particles = [
    { size: 14, x: '10%', y: '20%', delay: 0, dur: 6 },
    { size: 10, x: '85%', y: '15%', delay: 1.5, dur: 7 },
    { size: 12, x: '70%', y: '70%', delay: 3, dur: 5.5 },
    { size: 8, x: '20%', y: '80%', delay: 2, dur: 8 },
    { size: 16, x: '90%', y: '50%', delay: 4, dur: 6.5 },
    { size: 6, x: '50%', y: '10%', delay: 0.5, dur: 7.5 },
    { size: 10, x: '35%', y: '60%', delay: 2.5, dur: 5 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none motion-reduce:hidden" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute text-gold/[0.08] font-bold select-none"
          style={{
            fontSize: p.size,
            left: p.x,
            top: p.y,
            animation: `floatParticle ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        >
          &#x20B5;
        </span>
      ))}
    </div>
  );
}

/* ================================================================ */
/*  FEATURE VISUAL COMPONENTS                                        */
/* ================================================================ */
function SmsImportVisual() {
  return (
    <div className="flex items-start gap-2 mb-4">
      {/* Phone with SMS */}
      <div className="w-16 h-24 rounded-lg bg-white/[0.04] border border-white/[0.06] p-1.5 shrink-0">
        <div className="space-y-1">
          <div className="h-1.5 w-10 rounded bg-[#FFCC00]/30" />
          <div className="h-1 w-8 rounded bg-white/10" />
          <div className="h-1 w-12 rounded bg-white/10" />
          <div className="h-1 w-6 rounded bg-income/30" />
        </div>
      </div>
      {/* Arrow */}
      <svg className="w-5 h-5 text-gold/40 mt-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
      {/* Categorized list */}
      <div className="space-y-1 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-income" />
          <div className="h-1.5 w-10 rounded bg-income/30" />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-expense" />
          <div className="h-1.5 w-8 rounded bg-expense/30" />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gold" />
          <div className="h-1.5 w-12 rounded bg-gold/30" />
        </div>
      </div>
    </div>
  );
}

function AiAdvisorVisual() {
  return (
    <div className="space-y-2 mb-4">
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="bg-gold/15 rounded-xl rounded-br-sm px-2.5 py-1.5 max-w-[80%]">
          <p className="text-[10px] text-gold font-medium">How am I spending?</p>
        </div>
      </div>
      {/* AI bubble */}
      <div className="flex justify-start">
        <div className="bg-white/[0.05] rounded-xl rounded-bl-sm px-2.5 py-1.5 max-w-[90%]">
          <p className="text-[10px] text-white/60 leading-relaxed">
            You spent 40% on food this month. Try reducing by &#x20B5;200...
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardVisual() {
  return (
    <div className="mb-4">
      <div className="flex items-end gap-1 h-10">
        {[30, 50, 40, 70, 55, 80, 60].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-300"
            style={{
              height: `${h}%`,
              background: i === 5 ? '#D4A843' : 'rgba(212,168,67,0.15)',
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-[7px] text-white/20 flex-1 text-center">{d}</span>
        ))}
      </div>
    </div>
  );
}

function BudgetVisual() {
  const budgets = [
    { label: 'Food', pct: 75, color: '#D4A843' },
    { label: 'Transport', pct: 45, color: '#34D399' },
    { label: 'Airtime', pct: 90, color: '#EF4444' },
  ];
  return (
    <div className="space-y-2 mb-4">
      {budgets.map((b) => (
        <div key={b.label}>
          <div className="flex justify-between mb-0.5">
            <span className="text-[9px] text-white/50">{b.label}</span>
            <span className="text-[9px] text-white/30">{b.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${b.pct}%`, background: b.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SusuVisual() {
  const members = [
    { initials: 'AK', color: '#D4A843' },
    { initials: 'NB', color: '#34D399' },
    { initials: 'KO', color: '#3B82F6' },
    { initials: 'FA', color: '#EF4444' },
  ];
  return (
    <div className="flex items-center mb-4">
      <div className="flex -space-x-2">
        {members.map((m) => (
          <div
            key={m.initials}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-ghana-surface"
            style={{ background: m.color + '33', color: m.color }}
          >
            {m.initials}
          </div>
        ))}
      </div>
      <div className="ml-3">
        <p className="text-[10px] text-white/50 font-medium">Savings Group</p>
        <p className="text-[10px] text-gold">&#x20B5;2,400 pooled</p>
      </div>
    </div>
  );
}

function OfflineVisual() {
  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Phone with check */}
      <div className="w-10 h-14 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center relative">
        <svg className="w-5 h-5 text-income" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {/* WiFi off */}
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-ghana-surface flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
      </div>
      <div>
        <p className="text-[10px] text-income font-medium">Fully functional</p>
        <p className="text-[9px] text-white/30">Syncs when online</p>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  SUSU ECOSYSTEM DATA                                              */
/* ================================================================ */
const SUSU_TYPES = [
  { name: 'Funeral Fund', icon: '\uD83D\uDD4A\uFE0F', desc: 'Prepare for the unexpected with community support' },
  { name: 'School Fees', icon: '\uD83C\uDF93', desc: 'Save together for children\'s education' },
  { name: 'Diaspora Remit', icon: '\uD83C\uDF0D', desc: 'Cross-border group savings for Ghanaians abroad' },
  { name: 'Market Collector', icon: '\uD83C\uDFEA', desc: 'Digital susu collection for market traders' },
  { name: 'Wedding Fund', icon: '\uD83D\uDC8D', desc: 'Pool resources for wedding celebrations' },
  { name: 'Guarantee Fund', icon: '\uD83D\uDEE1\uFE0F', desc: 'Backed savings with group-level guarantees' },
  { name: 'Trader Groups', icon: '\uD83D\uDCE6', desc: 'Bulk buying power through group capital' },
  { name: 'Agric Seasonal', icon: '\uD83C\uDF3E', desc: 'Aligned with planting and harvest cycles' },
  { name: 'Church Welfare', icon: '\u26EA', desc: 'Faith-based community savings groups' },
  { name: 'Credit Cert', icon: '\uD83D\uDCDC', desc: 'Build a verified savings history for credit access' },
];

const SUSU_EXTRAS = ['Trust Scores', 'QR Invites', 'Digital Receipts', 'Badges', 'Group Chat', 'Analytics', 'Gamification'];

/* ================================================================ */
/*  FEATURE DATA                                                     */
/* ================================================================ */
const features = [
  {
    visual: <AiAdvisorVisual />,
    title: 'AI Financial Advisor',
    description: 'Streaming chat that understands MoMo fees, susu culture, and Ghanaian finance.',
  },
  {
    visual: <DashboardVisual />,
    title: 'Smart Dashboard',
    description: 'Daily trends, category breakdowns, and month-over-month insights at a glance.',
  },
  {
    visual: <BudgetVisual />,
    title: 'Budget & Goals',
    description: 'Monthly spending limits, savings targets, and visual progress tracking.',
  },
  {
    visual: <SmsImportVisual />,
    title: 'Import Transactions',
    description: 'SMS from 11 providers, CSV upload, or manual entry \u2014 all auto-categorized.',
  },
  {
    visual: <SusuVisual />,
    title: 'Investment Tracking',
    description: 'T-Bills, mutual funds, and fixed deposits with projected returns.',
  },
  {
    visual: <OfflineVisual />,
    title: 'Offline & PWA',
    description: 'Works without internet. Installable on any device. Syncs on reconnect.',
  },
];

/* ================================================================ */
/*  HOW IT WORKS DATA                                                */
/* ================================================================ */
const steps = [
  {
    number: '1',
    title: 'Sign up in 30 seconds',
    description: 'Phone number + 4-digit PIN. No email needed, no hassle.',
    visual: (
      <div className="w-12 h-18 mx-auto rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        <span className="text-gold text-xl font-bold">&#x20B5;</span>
      </div>
    ),
  },
  {
    number: '2',
    title: 'Import your transactions',
    description: 'Paste MoMo SMS messages or upload a CSV. We handle the rest.',
    visual: (
      <div className="flex items-center justify-center gap-1.5">
        <div className="w-6 h-8 rounded bg-white/[0.04] border border-white/[0.06]" />
        <svg className="w-4 h-4 text-gold/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    ),
  },
  {
    number: '3',
    title: 'Watch your wealth grow',
    description: 'Create Susu groups, budget smarter, and let AI guide your financial journey.',
    visual: (
      <div className="flex items-end justify-center gap-1 h-8">
        {[25, 40, 35, 55, 50, 70, 65].map((h, i) => (
          <div
            key={i}
            className="w-2 rounded-t-sm"
            style={{
              height: `${h}%`,
              background: i >= 5 ? '#34D399' : 'rgba(52,211,153,0.2)',
            }}
          />
        ))}
      </div>
    ),
  },
];

/* ================================================================ */
/*  PROVIDER DATA                                                    */
/* ================================================================ */
const providers = [
  { name: 'MTN MoMo', color: '#FFCC00' },
  { name: 'Vodafone Cash', color: '#E60000' },
  { name: 'AirtelTigo', color: '#2196F3' },
  { name: 'GCB Bank', color: '#006B3F' },
  { name: 'Ecobank', color: '#00A3E0' },
  { name: 'Fidelity Bank', color: '#1B3C73' },
  { name: 'Stanbic Bank', color: '#0033A0' },
  { name: 'Absa Bank', color: '#AF1F3A' },
];

/* ================================================================ */
/*  PRICING FEATURES                                                 */
/* ================================================================ */
const pricingFeatures = [
  'Unlimited transactions',
  '10 Susu group types',
  'AI chat advisor (40/day)',
  '11 provider SMS parsing',
  'Budgets & savings goals',
  'Full offline support',
  'Bill reminders',
  'CSV import & export',
  'PWA \u2014 install on any device',
];

/* ================================================================ */
/*  LANDING PAGE                                                     */
/* ================================================================ */
export function LandingPage() {
  const featuresRef = useScrollReveal();
  const stepsRef = useScrollReveal();
  const pricingRef = useScrollReveal();
  const providersRef = useScrollReveal();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Check URL params for auth modal
  useEffect(() => {
    const auth = searchParams.get('auth');
    if (auth === 'signin' || auth === 'register') {
      setAuthMode(auth);
      setAuthOpen(true);
      // Clean up the URL param
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openAuth = useCallback((mode: 'signin' | 'register') => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    setAuthOpen(false);
    navigate('/dashboard');
  }, [navigate]);

  const scrollToFeatures = useCallback(() => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-ghana-dark text-text-primary overflow-x-hidden">
      {/* --- Keyframe styles --- */}
      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
          50% { transform: translateY(-20px) rotate(5deg); opacity: 1; }
        }
        @keyframes growBar {
          0% { transform: scaleY(0); transform-origin: bottom; }
          100% { transform: scaleY(1); transform-origin: bottom; }
        }
        @keyframes checkPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* --- Background gradient mesh --- */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 15% 10%, rgba(212,168,67,0.08) 0%, transparent 55%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 85% 85%, rgba(0,107,63,0.06) 0%, transparent 50%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 40% 30% at 50% 50%, rgba(212,168,67,0.03) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* --- Sticky navbar (glassmorphism) --- */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          background: 'rgba(12,12,20,0.75)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-gold font-extrabold text-2xl leading-none">&#x20B5;</span>
            <span className="text-text-primary font-semibold text-lg tracking-[-0.02em]">CediSense</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openAuth('signin')}
              className="text-sm font-medium text-muted hover:text-text-primary transition-colors duration-200 px-3 py-2"
            >
              Sign In
            </button>
            <button
              onClick={() => openAuth('register')}
              className="btn-gold text-sm px-5 py-2 hidden sm:inline-flex"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/*  HERO SECTION                                                    */}
      {/* ================================================================ */}
      <section className="relative min-h-screen flex items-center px-6 pt-14">
        <FloatingParticles />

        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center py-16 lg:py-0">
          {/* Left — copy */}
          <div className="motion-safe:animate-slide-up max-w-xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-gold/[0.08] border border-gold/[0.12] rounded-full px-4 py-1.5 mb-8">
              <span className="text-[11px] font-semibold text-gold uppercase tracking-wider">Made in Ghana</span>
              <span className="text-sm" role="img" aria-label="Ghana flag">&#x1F1EC;&#x1F1ED;</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6">
              <span className="text-text-primary">Take Control</span>
              <br />
              <span className="text-text-primary">of Your </span>
              <span className="bg-gradient-to-r from-gold via-gold-light to-gold bg-clip-text text-transparent">
                Money
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted max-w-lg leading-relaxed mb-10">
              AI-powered personal finance for Ghana. Track Mobile Money, budget smarter, and grow your savings
              &mdash; all in one beautiful app.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => openAuth('register')}
                className="btn-gold text-base px-8 py-3.5 text-center"
              >
                Start Free &mdash; No Card Needed
              </button>
              <button
                onClick={scrollToFeatures}
                className="px-8 py-3.5 rounded-xl text-base font-semibold text-muted hover:text-text-primary bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] transition-all duration-200 active:scale-[0.98]"
              >
                See How It Works
              </button>
            </div>
          </div>

          {/* Right — phone mockup */}
          <div className="flex justify-center lg:justify-end motion-safe:animate-slide-up" style={{ animationDelay: '150ms' }}>
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  SOCIAL PROOF BAR                                                */}
      {/* ================================================================ */}
      <section className="relative py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-muted-dim text-xs uppercase tracking-widest mb-6">Trusted by Ghanaians</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x md:divide-white/[0.06]">
            {[
              { value: '11', label: 'Providers' },
              { value: '10', label: 'Susu Types' },
              { value: 'AI', label: 'Powered' },
              { value: '100%', label: 'Free' },
            ].map((stat) => (
              <div key={stat.label} className="text-center px-4">
                <p className="text-xl md:text-2xl font-extrabold text-text-primary tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  FEATURES SECTION                                                */}
      {/* ================================================================ */}
      {/* ================================================================ */}
      {/*  SUSU ECOSYSTEM — HERO FEATURE                                   */}
      {/* ================================================================ */}
      <section id="features" className="relative py-24 sm:py-32 px-6" ref={featuresRef}>
        <div className="max-w-6xl mx-auto">
          {/* Susu Ecosystem showcase */}
          <div className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0 mb-20">
            <div
              className="relative rounded-3xl overflow-hidden p-8 sm:p-10 lg:p-12"
              style={{
                background: 'linear-gradient(135deg, rgba(212,168,67,0.08) 0%, rgba(20,20,42,0.98) 30%, rgba(12,12,20,1) 100%)',
                border: '2px solid rgba(212,168,67,0.2)',
                boxShadow: '0 0 60px rgba(212,168,67,0.06), 0 0 120px rgba(212,168,67,0.03)',
              }}
            >
              {/* Gold glow accent */}
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(212,168,67,0.5), transparent)' }}
                aria-hidden="true"
              />
              <div
                className="absolute -top-20 -right-20 w-64 h-64 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(212,168,67,0.1) 0%, transparent 70%)' }}
                aria-hidden="true"
              />

              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl" role="img" aria-label="handshake">{'\uD83E\uDD1D'}</span>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-text-primary tracking-tight">
                      The Susu Ecosystem
                    </h2>
                  </div>
                  <p className="text-gold text-base sm:text-lg font-medium">
                    The world&apos;s most advanced digital Susu platform
                  </p>
                </div>
                <span className="self-start sm:self-auto bg-gold text-ghana-dark text-[11px] font-bold px-4 py-1.5 rounded-full whitespace-nowrap motion-safe:animate-pulse-soft">
                  {'\u2B50'} STAR FEATURE
                </span>
              </div>

              {/* Susu type grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
                {SUSU_TYPES.map((susu, i) => (
                  <div
                    key={susu.name}
                    className="group rounded-2xl p-4 border border-gold/[0.1] transition-all duration-200 hover:border-gold/30 hover:shadow-gold-glow cursor-default"
                    style={{
                      background: 'linear-gradient(135deg, rgba(212,168,67,0.06) 0%, rgba(12,12,20,0.95) 100%)',
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    <span className="text-2xl block mb-2">{susu.icon}</span>
                    <p className="text-text-primary text-sm font-semibold leading-tight mb-1">{susu.name}</p>
                    <p className="text-muted text-[11px] leading-snug">{susu.desc}</p>
                  </div>
                ))}
              </div>

              {/* Extra features */}
              <div className="flex flex-wrap gap-2 mb-8">
                {SUSU_EXTRAS.map((extra) => (
                  <span
                    key={extra}
                    className="text-xs font-medium text-gold/80 bg-gold/[0.06] border border-gold/[0.1] rounded-full px-3 py-1.5"
                  >
                    {extra}
                  </span>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => openAuth('register')}
                  className="btn-gold text-sm px-8 py-3"
                >
                  Create a Susu Group
                </button>
                <button
                  onClick={scrollToFeatures}
                  className="px-8 py-3 rounded-xl text-sm font-semibold text-gold border border-gold/30 hover:bg-gold/[0.06] transition-all duration-200 active:scale-[0.98]"
                >
                  Learn More
                </button>
              </div>
            </div>
          </div>

          {/* Regular features header */}
          <div className="text-center mb-16 reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <p className="section-label mb-4">Features</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-5">
              Built for how you <span className="text-gold">actually</span> manage money
            </h2>
            <p className="text-muted text-lg max-w-md mx-auto leading-relaxed">
              Not another Western finance app. This is made for Ghana.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div
                  className="rounded-2xl p-6 h-full border border-white/[0.05] group cursor-default"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212,168,67,0.04) 0%, rgba(20,20,42,0.95) 40%, rgba(12,12,20,0.98) 100%)',
                    transition: 'transform 0.25s ease-out, box-shadow 0.25s ease-out, border-color 0.25s ease-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.4), 0 0 40px rgba(212,168,67,0.06)';
                    e.currentTarget.style.borderColor = 'rgba(212,168,67,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  }}
                >
                  {/* Visual element */}
                  <div className="group-hover:scale-[1.02] transition-transform duration-300">
                    {feature.visual}
                  </div>
                  <h3 className="text-text-primary font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  PROVIDERS SECTION                                               */}
      {/* ================================================================ */}
      <section className="relative py-20 px-6" ref={providersRef}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <p className="section-label mb-4">Integrations</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
              Your providers, supported
            </h2>
            <p className="text-muted text-base leading-relaxed">
              Mobile Money and bank transaction parsing built in.
            </p>
          </div>

          <div className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {providers.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-2.5 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-200"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: p.color }}
                  />
                  <span className="text-sm font-medium text-muted whitespace-nowrap">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  HOW IT WORKS                                                    */}
      {/* ================================================================ */}
      <section className="relative py-24 sm:py-32 px-6" ref={stepsRef}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <p className="section-label mb-4">How it works</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-5">
              Three steps. Two minutes.
            </h2>
            <p className="text-muted text-lg max-w-md mx-auto leading-relaxed">
              From download to financial clarity in under two minutes.
            </p>
          </div>

          <div className="relative">
            {/* Connecting dotted line (desktop) */}
            <div className="hidden md:block absolute top-16 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)]" aria-hidden="true">
              <div
                className="h-px w-full"
                style={{
                  backgroundImage: 'repeating-linear-gradient(to right, rgba(212,168,67,0.25) 0, rgba(212,168,67,0.25) 6px, transparent 6px, transparent 12px)',
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
              {steps.map((step, i) => (
                <div
                  key={step.number}
                  className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0 text-center"
                  style={{ transitionDelay: `${i * 150}ms` }}
                >
                  {/* Number circle */}
                  <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-full mb-4">
                    <div className="absolute inset-0 rounded-full bg-gold/10 blur-xl scale-150" />
                    <div className="relative w-full h-full rounded-full bg-ghana-surface border border-gold/20 flex items-center justify-center">
                      <span className="text-gold font-bold text-lg">{step.number}</span>
                    </div>
                  </div>

                  {/* Mini visual */}
                  <div className="flex justify-center mb-4 h-10">
                    {step.visual}
                  </div>

                  <h3 className="text-text-primary font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed max-w-xs mx-auto">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  PRICING SECTION                                                 */}
      {/* ================================================================ */}
      <section className="relative py-24 sm:py-32 px-6" ref={pricingRef}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <p className="section-label mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-5">
              Free. No catch.
            </h2>
            <p className="text-muted text-lg max-w-md mx-auto leading-relaxed">
              Other apps charge &#x20B5;15&ndash;60/month. CediSense? <span className="text-gold font-semibold">Completely free.</span>
            </p>
          </div>

          <div className="reveal-on-scroll opacity-0 translate-y-6 transition-all duration-700 ease-out [&.revealed]:opacity-100 [&.revealed]:translate-y-0">
            <div
              className="rounded-2xl p-8 sm:p-10 border border-gold/[0.12] relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(212,168,67,0.06) 0%, rgba(20,20,42,0.98) 30%, rgba(12,12,20,1) 100%)',
              }}
            >
              {/* Corner accent */}
              <div
                className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at top right, rgba(212,168,67,0.08) 0%, transparent 70%)',
                }}
                aria-hidden="true"
              />

              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-4xl font-extrabold text-text-primary tracking-tight">&#x20B5;0</span>
                <span className="text-muted text-sm font-medium">/ forever</span>
              </div>
              <p className="text-muted text-sm mb-8 leading-relaxed">Everything you need to take control of your finances.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-10">
                {pricingFeatures.map((feature, i) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full bg-income/15 flex items-center justify-center shrink-0"
                      style={{ animation: `checkPop 0.4s ease-out ${i * 60}ms both` }}
                    >
                      <svg className="w-3 h-3 text-income" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-text-primary/90 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => openAuth('register')}
                className="btn-gold w-full text-center block py-4 text-base"
              >
                Get Started Free
              </button>
            </div>

            <p className="text-muted-dim/40 text-sm mt-6 text-center">
              Plus and Pro plans coming soon for power users.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  FOOTER                                                          */}
      {/* ================================================================ */}
      <footer className="relative py-14 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <span className="text-gold font-extrabold text-xl leading-none">&#x20B5;</span>
              <span className="text-text-primary font-semibold tracking-[-0.02em]">CediSense</span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#" className="text-muted-dim hover:text-muted text-sm transition-colors duration-200">Privacy</a>
              <a href="#" className="text-muted-dim hover:text-muted text-sm transition-colors duration-200">Terms</a>
            </div>
          </div>
          <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-muted-dim/50 text-sm">
              Built with care by <span className="text-muted-dim">Hodges &amp; Co.</span>
            </p>
            <p className="text-muted-dim/50 text-sm flex items-center gap-1.5">
              Made in Ghana <span role="img" aria-label="Ghana flag">&#x1F1EC;&#x1F1ED;</span>
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
