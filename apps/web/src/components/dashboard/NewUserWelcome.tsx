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

interface FeatureCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  cta: string;
  hero?: boolean;
  secondaryCta?: { label: string; route: string };
}

const FEATURES: FeatureCard[] = [
  {
    id: 'susu',
    name: 'Susu Groups',
    description: 'Start or join a rotating savings group \u2014 the smart way to save with your community',
    icon: '\uD83C\uDFC6',
    route: '/susu',
    cta: 'Create Group',
    secondaryCta: { label: 'Join Group', route: '/susu' },
    hero: true,
  },
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
    name: 'Set Your First Budget',
    description: 'Take control with monthly spending limits',
    icon: '\uD83D\uDCCA',
    route: '/budgets',
    cta: 'Create Budget',
  },
  {
    id: 'goal',
    name: 'Start a Savings Goal',
    description: 'Dream it. Save it. Achieve it.',
    icon: '\uD83C\uDFAF',
    route: '/goals',
    cta: 'Set Goal',
  },
  {
    id: 'ai',
    name: 'Chat with AI',
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
];

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

      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((feature, i) => {
          const isHero = feature.hero;

          return (
            <div
              key={feature.id}
              className={`motion-safe:animate-slide-up ${isHero ? 'md:col-span-2' : ''}`}
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
            >
              <div
                className={`relative rounded-2xl overflow-hidden transition-all duration-200 group ${
                  isHero
                    ? 'p-6 sm:p-8 border-2 border-gold/30 bg-gradient-to-br from-gold/[0.06] to-transparent hover:border-gold/50 hover:shadow-gold-glow-lg'
                    : 'p-5 border border-ghana-surface bg-ghana-surface hover:border-gold/20 hover:shadow-gold-glow'
                }`}
              >
                {/* Star badge for Susu */}
                {isHero && (
                  <span className="absolute top-3 right-3 bg-gold text-ghana-dark text-[10px] font-bold px-3 py-1 rounded-full motion-safe:animate-pulse-soft">
                    STAR FEATURE
                  </span>
                )}

                <div className={`flex ${isHero ? 'flex-col sm:flex-row' : 'flex-row'} items-start gap-4`}>
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 rounded-2xl flex items-center justify-center ${
                      isHero
                        ? 'w-16 h-16 text-3xl bg-gold/10 border border-gold/20'
                        : 'w-12 h-12 text-xl bg-ghana-elevated'
                    }`}
                  >
                    {feature.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold tracking-[-0.01em] ${isHero ? 'text-lg text-gold' : 'text-sm text-text-primary'}`}>
                      {isHero && <span className="mr-1">&#11088;</span>}
                      {feature.name}
                    </h3>
                    <p className={`text-muted leading-relaxed mt-1 ${isHero ? 'text-sm' : 'text-xs'}`}>
                      {feature.description}
                    </p>

                    {/* CTAs */}
                    <div className={`flex flex-wrap gap-3 ${isHero ? 'mt-5' : 'mt-3'}`}>
                      <button
                        onClick={() => handleNavigate(feature.route)}
                        className={`min-h-[44px] font-semibold rounded-xl transition-all duration-200 active:scale-[0.97] ${
                          isHero
                            ? 'px-6 py-2.5 bg-gold text-ghana-dark text-sm shadow-gold-btn hover:shadow-gold-glow'
                            : 'px-4 py-2 bg-gold/10 text-gold text-xs hover:bg-gold/20'
                        }`}
                      >
                        {feature.cta}
                        <svg className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                      {feature.secondaryCta && (
                        <button
                          onClick={() => handleNavigate(feature.secondaryCta!.route)}
                          className="min-h-[44px] px-6 py-2.5 border border-gold/30 text-gold text-sm font-semibold rounded-xl hover:bg-gold/[0.06] transition-all duration-200 active:scale-[0.97]"
                        >
                          {feature.secondaryCta.label}
                          <svg className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
