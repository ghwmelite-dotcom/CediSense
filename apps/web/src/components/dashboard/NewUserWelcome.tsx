import { useNavigate } from 'react-router-dom';

const WELCOME_DISMISSED_KEY = 'cedisense-welcome-dismissed';

export function isWelcomeDismissed(): boolean {
  try {
    return localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissWelcome(): void {
  try {
    localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
  } catch {
    // localStorage not available
  }
}

/* ─── Susu Types ──────────────────────────────────────────────────────────── */

const SUSU_TYPES = [
  'Rotating', 'Funeral Fund', 'School Fees', 'Diaspora',
  'Wedding', 'Guarantee', 'Trader', 'Agricultural', 'Welfare', 'Bidding',
];

/* ─── Feature Cards ───────────────────────────────────────────────────────── */

interface FeatureCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  cta: string;
}

const FEATURES: FeatureCard[] = [
  {
    id: 'import',
    name: 'Import Transactions',
    description: 'Paste your MoMo SMS or upload CSV to get started',
    icon: '\uD83D\uDCF1',
    route: '/transactions/import',
    cta: 'Import Now',
  },
  {
    id: 'budget',
    name: 'Set Budgets',
    description: 'Take control with monthly spending limits',
    icon: '\uD83D\uDCCA',
    route: '/budgets',
    cta: 'Create Budget',
  },
  {
    id: 'goal',
    name: 'Savings Goals',
    description: 'Dream it. Save it. Achieve it.',
    icon: '\uD83C\uDFAF',
    route: '/goals',
    cta: 'Set Goal',
  },
  {
    id: 'ai',
    name: 'AI Chat Advisor',
    description: 'Ask your personal finance advisor anything',
    icon: '\uD83D\uDCAC',
    route: '/ai-chat',
    cta: 'Start Chat',
  },
  {
    id: 'invest',
    name: 'Track Investments',
    description: 'Monitor your T-Bills, mutual funds, and more',
    icon: '\uD83D\uDCC8',
    route: '/investments',
    cta: 'Add Investment',
  },
  {
    id: 'collector',
    name: 'Become a Collector',
    description: 'Manage susu collections for your community',
    icon: '\uD83C\uDFEA',
    route: '/collector',
    cta: 'Get Started',
  },
  {
    id: 'insights',
    name: 'View Insights',
    description: 'See where your money goes each month',
    icon: '\uD83D\uDCA1',
    route: '/insights',
    cta: 'View Now',
  },
  {
    id: 'bills',
    name: 'Manage Bills',
    description: 'Track recurring payments and never miss a due date',
    icon: '\uD83D\uDD14',
    route: '/recurring',
    cta: 'Add Bill',
  },
];

/* ─── Component ───────────────────────────────────────────────────────────── */

interface Props {
  userName: string;
  onDismiss: () => void;
}

export function NewUserWelcome({ userName, onDismiss }: Props) {
  const navigate = useNavigate();
  const firstName = userName?.split(' ')[0] ?? '';

  function handleNavigate(route: string) {
    navigate(route);
  }

  function handleDismiss() {
    dismissWelcome();
    onDismiss();
  }

  return (
    <div className="px-6 pt-6 pb-24 max-w-screen-lg mx-auto">
      {/* Hero greeting */}
      <div className="text-center mb-8 motion-safe:animate-fade-in">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-[-0.03em]">
          Welcome{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-muted text-base mt-2">
          Here&apos;s what you can do with CediSense
        </p>
      </div>

      {/* ─── Susu Groups — Hero Section ──────────────────────────────── */}
      <div
        className="motion-safe:animate-slide-up mb-6"
        style={{ animationFillMode: 'both' }}
      >
        <div
          className="relative rounded-2xl overflow-hidden p-6 sm:p-8 border-2 border-gold/30 hover:border-gold/50 hover:shadow-gold-glow-lg transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, rgba(212,168,67,0.08) 0%, rgba(20,20,42,0.98) 40%, transparent 100%)',
          }}
        >
          {/* Star badge */}
          <span className="absolute top-3 right-3 bg-gold text-ghana-dark text-[10px] font-bold px-3 py-1 rounded-full motion-safe:animate-pulse-soft">
            STAR FEATURE
          </span>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-gold/10 border border-gold/20">
              {'\uD83C\uDFC6'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gold tracking-[-0.01em]">
                <span className="mr-1">{'\u2B50'}</span>
                Susu Groups
              </h3>
              <p className="text-muted text-sm leading-relaxed">
                10 types of savings groups for every occasion
              </p>
            </div>
          </div>

          {/* Susu type pills */}
          <div className="flex flex-wrap gap-2 mt-4 mb-5">
            {SUSU_TYPES.map((type) => (
              <span
                key={type}
                className="text-xs font-medium text-gold/90 bg-gold/[0.08] border border-gold/[0.12] rounded-full px-3 py-1.5"
              >
                {type}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => handleNavigate('/susu')}
              className="min-h-[44px] px-6 py-2.5 bg-gold text-ghana-dark text-sm font-semibold rounded-xl shadow-gold-btn hover:shadow-gold-glow active:scale-[0.97] transition-all duration-200"
            >
              Create Group
              <svg className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button
              onClick={() => handleNavigate('/susu')}
              className="min-h-[44px] px-6 py-2.5 border border-gold/30 text-gold text-sm font-semibold rounded-xl hover:bg-gold/[0.06] transition-all duration-200 active:scale-[0.97]"
            >
              Join Group
              <svg className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Other Features — 2-col Grid ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((feature, i) => (
          <div
            key={feature.id}
            className="motion-safe:animate-slide-up"
            style={{ animationDelay: `${(i + 1) * 80}ms`, animationFillMode: 'both' }}
          >
            <div className="p-5 border border-ghana-surface bg-ghana-surface rounded-2xl hover:border-gold/20 hover:shadow-gold-glow transition-all duration-200">
              <div className="flex flex-row items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-12 h-12 text-xl bg-ghana-elevated rounded-2xl flex items-center justify-center">
                  {feature.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-text-primary tracking-[-0.01em]">
                    {feature.name}
                  </h3>
                  <p className="text-muted text-xs leading-relaxed mt-1">
                    {feature.description}
                  </p>

                  {/* CTA */}
                  <div className="mt-3">
                    <button
                      onClick={() => handleNavigate(feature.route)}
                      className="min-h-[44px] px-4 py-2 bg-gold/10 text-gold text-xs font-semibold rounded-xl hover:bg-gold/20 transition-all duration-200 active:scale-[0.97]"
                    >
                      {feature.cta}
                      <svg className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dismiss */}
      <div className="text-center mt-8 motion-safe:animate-fade-in" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
        <button
          onClick={handleDismiss}
          className="text-muted text-sm hover:text-text-primary transition-colors min-h-[44px] px-4"
        >
          Dismiss and show dashboard
        </button>
      </div>
    </div>
  );
}
