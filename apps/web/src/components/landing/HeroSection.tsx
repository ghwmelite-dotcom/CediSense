import { useEffect, useState } from 'react';

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
/*  HERO SECTION                                                     */
/* ================================================================ */
interface HeroSectionProps {
  onOpenAuth: (mode: 'signin' | 'register') => void;
  onScrollToFeatures: () => void;
}

export function HeroSection({ onOpenAuth, onScrollToFeatures }: HeroSectionProps) {
  return (
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
              onClick={() => onOpenAuth('register')}
              className="btn-gold text-base px-8 py-3.5 text-center"
            >
              Start Free &mdash; No Card Needed
            </button>
            <button
              onClick={onScrollToFeatures}
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
  );
}
