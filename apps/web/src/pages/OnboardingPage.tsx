import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { IncomeStep } from '@/components/onboarding/IncomeStep';
import { AccountStep } from '@/components/onboarding/AccountStep';
import { FirstTransactionStep } from '@/components/onboarding/FirstTransactionStep';
import type { Account } from '@cedisense/shared';

const STEP_LABELS = ['Income', 'Account', 'First Move'];

const STEP_SUBTITLES = [
  'Tell us about your earnings',
  'Connect your money source',
  'Record your first move',
];

export function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [animKey, setAnimKey] = useState(0);

  // Determine which step to start at based on existing data
  useEffect(() => {
    async function checkProgress() {
      try {
        const accounts = await api.get<Account[]>('/accounts');
        if (user?.monthly_income_ghs != null) {
          if (accounts.length > 0) {
            setStep(3);
          } else {
            setStep(2);
          }
        }
      } catch {
        // Default to step 1
      } finally {
        setLoading(false);
      }
    }
    checkProgress();
  }, [user]);

  function goToStep(next: number) {
    setAnimKey((k) => k + 1);
    setStep(next);
  }

  async function handleIncomeComplete(income: number) {
    await api.put('/users/me', { monthly_income_ghs: income });
    await refreshUser();
    goToStep(2);
  }

  async function handleAccountComplete(account: { name: string; type: string; provider: string }) {
    await api.post('/accounts', {
      name: account.name,
      type: account.type,
      provider: account.provider,
      is_primary: true,
    });
    goToStep(3);
  }

  async function handleFinish() {
    await api.put('/users/me/onboarding', { completed: true });
    await refreshUser();
    navigate('/dashboard');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghana-dark relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% -20%, rgba(212,168,67,0.05) 0%, transparent 70%)',
          }}
        />
        <div className="flex flex-col items-center gap-3 z-10">
          <div className="w-10 h-10 border-2 border-gold/20 border-t-gold rounded-full motion-safe:animate-spin" />
          <p className="text-muted text-sm">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-ghana-dark relative overflow-hidden">
      {/* Rich ambient gradients */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 30% -10%, rgba(212,168,67,0.08) 0%, transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 70% 110%, rgba(34,197,94,0.05) 0%, transparent 60%)',
        }}
      />
      {/* Decorative floating dots */}
      <div
        className="pointer-events-none absolute top-[20%] left-[10%] w-2 h-2 rounded-full bg-gold/10 motion-safe:animate-float"
        style={{ animationDelay: '0s' }}
      />
      <div
        className="pointer-events-none absolute top-[30%] right-[15%] w-1.5 h-1.5 rounded-full bg-gold/[0.07] motion-safe:animate-float"
        style={{ animationDelay: '1.5s' }}
      />
      <div
        className="pointer-events-none absolute bottom-[25%] left-[20%] w-1 h-1 rounded-full bg-income/10 motion-safe:animate-float"
        style={{ animationDelay: '3s' }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Branding with premium feel */}
        <div className="text-center mb-8 motion-safe:animate-fade-in">
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4">
            <div className="absolute inset-0 rounded-2xl bg-gold/10 blur-xl scale-[2] motion-safe:animate-glow-pulse" />
            <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/15 flex items-center justify-center shadow-gold-glow">
              <span className="text-gold font-extrabold text-3xl leading-none">₵</span>
            </div>
          </div>
          <h2 className="text-text-primary font-semibold text-lg tracking-tight mb-1">
            Welcome to CediSense
          </h2>
          <p className="text-muted text-sm">
            {STEP_SUBTITLES[step - 1]}
          </p>
        </div>

        {/* Step indicator -- premium with progress bar */}
        <div className="flex items-center justify-center mb-8 motion-safe:animate-fade-in">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`relative flex items-center justify-center rounded-full font-semibold text-xs transition-all duration-500 ${
                    s < step
                      ? 'w-8 h-8 bg-gradient-to-br from-gold-light to-gold text-ghana-dark shadow-gold-btn'
                      : s === step
                        ? 'w-9 h-9 bg-gradient-to-br from-gold-light to-gold text-ghana-dark shadow-gold-glow-lg ring-4 ring-gold/10'
                        : 'w-8 h-8 bg-[#171727] border border-[#1F1F35] text-muted-dim'
                  }`}
                >
                  {s < step ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium tracking-wide uppercase transition-colors duration-300 ${
                    s <= step ? 'text-gold/80' : 'text-muted-dim/40'
                  }`}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>

              {/* Connector line */}
              {i < 2 && (
                <div className="w-12 h-[2px] mx-2 mb-5 relative overflow-hidden rounded-full bg-[#1F1F35]">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold to-gold-light transition-all duration-700 ease-out rounded-full"
                    style={{ width: s < step ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Step content with premium card wrapper */}
        <div key={animKey} className="motion-safe:animate-slide-up">
          <div className="premium-card rounded-2xl p-6 relative overflow-hidden">
            {/* Subtle top shimmer */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/15 to-transparent" />

            {step === 1 && (
              <IncomeStep onComplete={handleIncomeComplete} onSkip={() => goToStep(2)} />
            )}
            {step === 2 && (
              <AccountStep onComplete={handleAccountComplete} onSkip={() => goToStep(3)} />
            )}
            {step === 3 && (
              <FirstTransactionStep onComplete={handleFinish} onSkip={handleFinish} />
            )}
          </div>
        </div>

        {/* Step progress text */}
        <p className="text-center text-muted-dim/50 text-xs mt-6 tracking-wide">
          Step {step} of 3
        </p>
      </div>

      {/* Footer */}
      <p className="mt-auto pt-8 pb-6 text-muted-dim/30 text-xs tracking-wider">
        Built by Hodges &amp; Co.
      </p>
    </div>
  );
}
