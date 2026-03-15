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
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="w-10 h-10 border-2 border-gold/20 border-t-gold rounded-full motion-safe:animate-spin" />
          <p className="text-muted text-sm">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-ghana-dark relative overflow-hidden">
      {/* Subtle ambient gradients */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 30% -10%, rgba(212,168,67,0.06) 0%, transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 70% 110%, rgba(52,211,153,0.04) 0%, transparent 60%)',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Branding — confident, clean */}
        <div className="text-center mb-10 motion-safe:animate-fade-in">
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5">
            <div className="absolute inset-0 rounded-2xl bg-gold/8 blur-xl scale-[2] motion-safe:animate-glow-pulse" />
            <div className="relative w-full h-full rounded-2xl bg-ghana-surface flex items-center justify-center shadow-card">
              <span className="text-gold font-extrabold text-3xl leading-none">₵</span>
            </div>
          </div>
          <h2 className="text-text-primary font-extrabold text-xl tracking-[-0.02em] mb-1.5">
            Welcome to CediSense
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            {STEP_SUBTITLES[step - 1]}
          </p>
        </div>

        {/* Step indicator — clean, minimal */}
        <div className="flex items-center justify-center mb-10 motion-safe:animate-fade-in">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`relative flex items-center justify-center rounded-full font-semibold text-xs transition-all duration-500 ${
                    s < step
                      ? 'w-8 h-8 bg-gold text-ghana-dark'
                      : s === step
                        ? 'w-9 h-9 bg-gold text-ghana-dark shadow-gold-glow'
                        : 'w-8 h-8 bg-ghana-surface text-muted-dim'
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
                  className={`text-[10px] font-semibold tracking-wider uppercase transition-colors duration-300 ${
                    s <= step ? 'text-text-primary' : 'text-muted-dim/40'
                  }`}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>

              {/* Connector line */}
              {i < 2 && (
                <div className="w-12 h-[2px] mx-3 mb-5 relative overflow-hidden rounded-full bg-ghana-surface">
                  <div
                    className="absolute inset-y-0 left-0 bg-gold transition-all duration-700 ease-out rounded-full"
                    style={{ width: s < step ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Step content — clean card wrapper */}
        <div key={animKey} className="motion-safe:animate-slide-up">
          <div className="premium-card rounded-2xl p-6 relative overflow-hidden">
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
        <p className="text-center text-muted-dim/40 text-xs mt-8 tracking-wide">
          Step {step} of 3
        </p>
      </div>

      {/* Footer */}
      <p className="mt-auto pt-10 pb-6 text-muted-dim/25 text-xs tracking-wider">
        Built by Hodges &amp; Co.
      </p>
    </div>
  );
}
