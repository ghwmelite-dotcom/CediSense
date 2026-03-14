import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { IncomeStep } from '@/components/onboarding/IncomeStep';
import { AccountStep } from '@/components/onboarding/AccountStep';
import { FirstTransactionStep } from '@/components/onboarding/FirstTransactionStep';
import type { Account } from '@cedisense/shared';

const STEP_LABELS = ['Income', 'Account', 'First Move'];

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
    navigate('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ghana-dark relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,168,67,0.10) 0%, transparent 70%)',
          }}
        />
        <div className="flex flex-col items-center gap-3 z-10">
          <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full motion-safe:animate-spin" />
          <p className="text-muted text-sm">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-ghana-dark relative overflow-hidden">
      {/* Radial gold glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,168,67,0.11) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 110%, rgba(0,107,63,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Branding */}
        <div className="text-center mb-8 motion-safe:animate-fade-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 shadow-gold-glow mb-3">
            <span className="text-gold font-extrabold text-2xl leading-none">₵</span>
          </div>
          <p className="text-muted text-xs uppercase tracking-widest font-medium">
            Let's get you set up
          </p>
        </div>

        {/* Step indicator with connecting lines */}
        <div className="flex items-center justify-center mb-8 motion-safe:animate-fade-in">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center">
              {/* Dot */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`relative flex items-center justify-center rounded-full font-semibold text-xs transition-all duration-500 ${
                    s < step
                      ? 'w-8 h-8 bg-gold text-ghana-dark shadow-gold-glow'
                      : s === step
                        ? 'w-9 h-9 bg-gold text-ghana-dark shadow-gold-glow-lg ring-4 ring-gold/20'
                        : 'w-8 h-8 bg-ghana-surface border border-white/10 text-muted'
                  }`}
                >
                  {s < step ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    s
                  )}
                  {/* Pulse ring on active step */}
                  {s === step && (
                    <span className="absolute inset-0 rounded-full bg-gold/20 motion-safe:animate-ping" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium tracking-wide uppercase transition-colors duration-300 ${
                    s <= step ? 'text-gold' : 'text-white/20'
                  }`}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>

              {/* Connector line */}
              {i < 2 && (
                <div className="w-12 h-px mx-2 mb-5 relative overflow-hidden rounded-full bg-ghana-surface">
                  <div
                    className="absolute inset-y-0 left-0 bg-gold transition-all duration-500 ease-out"
                    style={{ width: s < step ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Step content — re-mounts with new key to trigger slide-up animation */}
        <div key={animKey} className="motion-safe:animate-slide-up">
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

      {/* Footer */}
      <p className="absolute bottom-6 text-white/20 text-xs tracking-wide">
        Built by Hodges &amp; Co.
      </p>
    </div>
  );
}
