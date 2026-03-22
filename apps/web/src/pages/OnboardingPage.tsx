import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { Account } from '@cedisense/shared';
import { OnboardingStep, GoldParticles } from './OnboardingStep';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface AccountOption {
  id: string;
  name: string;
  type: 'momo' | 'bank' | 'cash' | 'susu';
  color: string;
  icon: string;
  subtitle: string;
  badge?: string;
}

type FeatureId = 'susu' | 'spending' | 'budgets' | 'goals' | 'ai' | 'collector' | 'investments';

interface FeatureOption {
  id: FeatureId;
  name: string;
  description: string;
  icon: string;
  star?: boolean;
  badge?: string;
}

/* ─── Data ───────────────────────────────────────────────────────────────────── */

const QUICK_AMOUNTS = [1_000, 2_000, 3_000, 5_000, 10_000];

const ACCOUNT_OPTIONS: AccountOption[] = [
  { id: 'mtn', name: 'MTN MoMo', type: 'momo', color: '#FFCC00', icon: '📱', subtitle: "Ghana's most popular", badge: undefined },
  { id: 'vodafone', name: 'Vodafone Cash', type: 'momo', color: '#E60000', icon: '📱', subtitle: 'Mobile Money', badge: undefined },
  { id: 'airteltigo', name: 'AirtelTigo Money', type: 'momo', color: '#0066FF', icon: '📱', subtitle: 'Mobile Money', badge: undefined },
  { id: 'bank', name: 'Bank Account', type: 'bank', color: '#006B3F', icon: '🏦', subtitle: 'GCB, Ecobank, Fidelity...', badge: undefined },
  { id: 'cash', name: 'Cash', type: 'cash', color: '#5A5A72', icon: '💵', subtitle: 'Physical cash tracking', badge: undefined },
  { id: 'susu', name: 'Susu', type: 'susu', color: '#D4A843', icon: '🏆', subtitle: 'Traditional savings', badge: 'POPULAR' },
];

const FEATURE_OPTIONS: FeatureOption[] = [
  { id: 'susu', name: 'Susu Groups', description: '10 types including Funeral Fund, School Fees, Diaspora, Wedding, and more', icon: '\uD83C\uDFC6', star: true, badge: 'NEW' },
  { id: 'spending', name: 'Track Spending', description: 'Import SMS transactions and see where your money goes', icon: '\uD83D\uDCCA' },
  { id: 'budgets', name: 'Set Budgets', description: 'Control your spending with monthly category limits', icon: '\uD83D\uDCB0' },
  { id: 'goals', name: 'Save for Goals', description: 'Set targets and track your progress', icon: '\uD83C\uDFAF' },
  { id: 'ai', name: 'AI Advisor', description: 'Get personalized financial advice', icon: '\uD83D\uDCAC' },
  { id: 'collector', name: 'Market Collector', description: 'Manage susu collections for traders in your community', icon: '\uD83C\uDFEA', badge: 'NEW' },
  { id: 'investments', name: 'Track Investments', description: 'T-Bills, mutual funds, and fixed deposits with returns', icon: '\uD83D\uDCC8', badge: 'NEW' },
];

const FEATURE_ROUTES: Record<FeatureId, string> = {
  susu: '/susu',
  spending: '/transactions/import',
  budgets: '/budgets',
  goals: '/goals',
  ai: '/ai-chat',
  collector: '/collector',
  investments: '/investments',
};

/* ─── Step 1: Welcome ────────────────────────────────────────────────────────── */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center relative">
      <GoldParticles />

      {/* Animated Logo */}
      <div className="relative motion-safe:animate-logo-reveal mb-8">
        <div className="absolute inset-0 rounded-3xl bg-gold/10 blur-2xl scale-[2.5] motion-safe:animate-glow-pulse" />
        <div className="relative w-24 h-24 rounded-3xl bg-ghana-surface flex items-center justify-center shadow-gold-glow-lg border border-gold/10">
          <span className="text-gold font-extrabold text-6xl leading-none">₵</span>
        </div>
      </div>

      {/* Text */}
      <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-text-primary tracking-[-0.03em] motion-safe:animate-fade-in">
        Welcome to CediSense
      </h1>
      <p className="text-muted text-base mt-3 max-w-xs leading-relaxed motion-safe:animate-fade-in" style={{ animationDelay: '150ms', animationFillMode: 'both' }}>
        Your AI-powered financial companion, built for Ghana
      </p>

      {/* CTA */}
      <button
        onClick={onNext}
        className="mt-10 min-h-[48px] px-10 py-3.5 bg-gold text-ghana-dark font-bold text-base rounded-2xl shadow-gold-btn hover:shadow-gold-glow-lg active:scale-[0.97] transition-all duration-200 motion-safe:animate-fade-in"
        style={{ animationDelay: '300ms', animationFillMode: 'both' }}
      >
        Let&apos;s Go
      </button>

      <p className="text-muted-dim/30 text-xs mt-6 motion-safe:animate-fade-in" style={{ animationDelay: '450ms', animationFillMode: 'both' }}>
        Takes less than 2 minutes
      </p>
    </div>
  );
}

/* ─── Step 2: Income ─────────────────────────────────────────────────────────── */

function IncomeStep({ onNext, onSkip }: { onNext: (income: number) => void; onSkip: () => void }) {
  const [amount, setAmount] = useState('');

  return (
    <div className="premium-card rounded-2xl p-6 sm:p-8">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-bold font-display text-text-primary tracking-[-0.02em]">
          What&apos;s your monthly income?
        </h2>
        <p className="text-muted text-sm mt-2">This helps us personalize your experience</p>
      </div>

      {/* Amount input */}
      <div className="flex items-center justify-center gap-3 mt-8">
        <span className="text-gold text-3xl font-bold">₵</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          className="bg-ghana-surface border-2 border-gold/30 focus:border-gold rounded-xl px-5 py-4 text-3xl text-text-primary text-center w-48 focus:outline-none focus:shadow-gold-glow transition-all duration-200"
          autoFocus
        />
      </div>

      {/* Quick picks */}
      <div className="flex flex-wrap gap-2 justify-center mt-6">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            onClick={() => setAmount(String(a))}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              amount === String(a)
                ? 'bg-gold/15 text-gold border border-gold/30'
                : 'bg-ghana-surface text-muted border border-transparent hover:border-gold/20 hover:text-text-primary'
            }`}
          >
            ₵{a.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onSkip}
          className="flex-1 min-h-[48px] py-3 text-muted text-sm font-medium hover:text-text-primary transition-colors rounded-xl"
        >
          Skip
        </button>
        <button
          onClick={() => amount && onNext(parseFloat(amount))}
          disabled={!amount || parseFloat(amount) <= 0}
          className="flex-[2] min-h-[48px] bg-gold text-ghana-dark font-bold py-3 rounded-xl disabled:opacity-40 shadow-gold-btn hover:shadow-gold-glow active:scale-[0.97] transition-all duration-200"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/* ─── Step 3: Account ────────────────────────────────────────────────────────── */

function AccountStep({
  onNext,
  onSkip,
}: {
  onNext: (account: { name: string; type: string; provider: string }) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');

  const selectedOption = ACCOUNT_OPTIONS.find((o) => o.id === selected);

  function handleContinue() {
    if (!selectedOption) return;
    onNext({
      name: accountName || selectedOption.name,
      type: selectedOption.type,
      provider: selectedOption.id,
    });
  }

  return (
    <div className="premium-card rounded-2xl p-6 sm:p-8">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-bold font-display text-text-primary tracking-[-0.02em]">
          Where do you keep your money?
        </h2>
        <p className="text-muted text-sm mt-2">Select your primary account type</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-6">
        {ACCOUNT_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              onClick={() => {
                setSelected(option.id);
                setAccountName('');
              }}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 min-h-[100px] ${
                isSelected
                  ? 'border-gold bg-gold/[0.06] shadow-gold-glow'
                  : 'border-ghana-surface bg-ghana-surface hover:border-muted-dim/30'
              }`}
            >
              {option.badge && (
                <span className="absolute -top-2 -right-2 bg-gold text-ghana-dark text-[9px] font-bold px-2 py-0.5 rounded-full">
                  {option.badge}
                </span>
              )}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ backgroundColor: `${option.color}20` }}
              >
                {option.icon}
              </div>
              <div className="text-center">
                <div className={`font-semibold text-sm ${isSelected ? 'text-gold' : 'text-text-primary'}`}>
                  {option.name}
                </div>
                <div className="text-muted text-[10px] mt-0.5">{option.subtitle}</div>
              </div>
              {isSelected && (
                <div className="absolute top-2 left-2 w-5 h-5 bg-gold rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-ghana-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Account name input after selection */}
      {selected && (
        <div className="mt-5 motion-safe:animate-fade-in">
          <label className="block text-muted text-xs font-medium mb-2 tracking-wide uppercase">
            Account name (optional)
          </label>
          <input
            type="text"
            placeholder={selectedOption?.name ?? 'My Account'}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full bg-ghana-surface border border-gold/20 focus:border-gold rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:shadow-gold-glow transition-all duration-200"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onSkip}
          className="flex-1 min-h-[48px] py-3 text-muted text-sm font-medium hover:text-text-primary transition-colors rounded-xl"
        >
          Skip
        </button>
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="flex-[2] min-h-[48px] bg-gold text-ghana-dark font-bold py-3 rounded-xl disabled:opacity-40 shadow-gold-btn hover:shadow-gold-glow active:scale-[0.97] transition-all duration-200"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/* ─── Step 4: Feature Selector ───────────────────────────────────────────────── */

function FeatureStep({ onComplete }: { onComplete: (features: FeatureId[]) => void }) {
  const [selected, setSelected] = useState<Set<FeatureId>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(id: FeatureId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleContinue() {
    setSaving(true);
    onComplete(Array.from(selected));
  }

  return (
    <div className="premium-card rounded-2xl p-6 sm:p-8">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-bold font-display text-text-primary tracking-[-0.02em]">
          What would you like to do first?
        </h2>
        <p className="text-muted text-sm mt-2">Select all that interest you</p>
      </div>

      <div className="flex flex-col gap-3 mt-6">
        {FEATURE_OPTIONS.map((feature) => {
          const isSelected = selected.has(feature.id);
          const isStar = feature.star;
          return (
            <button
              key={feature.id}
              onClick={() => toggle(feature.id)}
              className={`relative flex items-start gap-4 text-left rounded-2xl border-2 transition-all duration-200 ${
                isStar ? 'p-5' : 'p-4'
              } ${
                isSelected
                  ? isStar
                    ? 'border-gold bg-gold/[0.08] shadow-gold-glow'
                    : 'border-gold/60 bg-gold/[0.04]'
                  : isStar
                    ? 'border-gold/30 bg-ghana-surface'
                    : 'border-ghana-surface bg-ghana-surface hover:border-muted-dim/30'
              }`}
            >
              {/* Badge */}
              {feature.badge && (
                <span className="absolute -top-2 right-3 bg-gold text-ghana-dark text-[9px] font-bold px-2.5 py-0.5 rounded-full motion-safe:animate-pulse-soft">
                  {feature.badge}
                </span>
              )}

              {/* Icon */}
              <div className={`flex-shrink-0 rounded-xl flex items-center justify-center ${isStar ? 'w-12 h-12 text-2xl bg-gold/10' : 'w-10 h-10 text-lg bg-ghana-elevated'}`}>
                {feature.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className={`font-bold ${isStar ? 'text-base text-gold' : 'text-sm text-text-primary'}`}>
                  {isStar && <span className="mr-1">&#11088;</span>}
                  {feature.name}
                </div>
                <p className={`text-muted mt-0.5 leading-relaxed ${isStar ? 'text-sm' : 'text-xs'}`}>
                  {feature.description}
                </p>
              </div>

              {/* Checkbox */}
              <div
                className={`flex-shrink-0 mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
                  isSelected
                    ? 'bg-gold border-gold'
                    : 'border-muted-dim/30 bg-transparent'
                }`}
              >
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-ghana-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Continue */}
      <button
        onClick={handleContinue}
        disabled={saving}
        className="w-full min-h-[48px] mt-8 bg-gold text-ghana-dark font-bold py-3.5 rounded-xl shadow-gold-btn hover:shadow-gold-glow active:scale-[0.97] transition-all duration-200 disabled:opacity-60"
      >
        {saving ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-ghana-dark/30 border-t-ghana-dark rounded-full motion-safe:animate-spin" />
            Setting up...
          </span>
        ) : (
          'Continue'
        )}
      </button>

      <button
        onClick={() => handleContinue()}
        disabled={saving}
        className="w-full min-h-[44px] mt-2 text-muted text-sm font-medium hover:text-text-primary transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */

export function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<'left' | 'right'>('left');
  const [animKey, setAnimKey] = useState(0);

  // Check progress to determine starting step
  useEffect(() => {
    async function checkProgress() {
      try {
        const accounts = await api.get<Account[]>('/accounts');
        if (user?.monthly_income_ghs != null) {
          if (accounts.length > 0) {
            setStep(4);
          } else {
            setStep(3);
          }
        } else {
          // Still show welcome (step 1) for fresh users
          setStep(1);
        }
      } catch {
        // Default to step 1
      } finally {
        setLoading(false);
      }
    }
    checkProgress();
  }, [user]);

  const goToStep = useCallback((next: number) => {
    setDirection(next > step ? 'left' : 'right');
    setAnimKey((k) => k + 1);
    setStep(next);
  }, [step]);

  async function handleIncomeComplete(income: number) {
    await api.put('/users/me', { monthly_income_ghs: income });
    await refreshUser();
    goToStep(3);
  }

  async function handleAccountComplete(account: { name: string; type: string; provider: string }) {
    await api.post('/accounts', {
      name: account.name,
      type: account.type,
      provider: account.provider,
      is_primary: true,
    });
    goToStep(4);
  }

  async function handleFinish(features: FeatureId[]) {
    await api.put('/users/me/onboarding', { completed: true });
    await refreshUser();

    // Navigate to the first selected feature or dashboard
    if (features.length === 1) {
      navigate(FEATURE_ROUTES[features[0]]);
    } else {
      navigate('/dashboard');
    }
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

  // Step 1 is full-screen, no card wrapper
  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-ghana-dark relative overflow-hidden">
        {/* Ambient gradients */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 40% at 30% -10%, rgba(212,168,67,0.08) 0%, transparent 60%)' }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 50% 40% at 70% 110%, rgba(212,168,67,0.04) 0%, transparent 60%)' }}
        />

        <WelcomeStep onNext={() => goToStep(2)} />

        {/* Footer */}
        <p className="mt-auto pt-10 pb-6 text-muted-dim/25 text-xs tracking-wider">
          Built by Hodges &amp; Co.
        </p>
      </div>
    );
  }

  return (
    <OnboardingStep currentStep={step} totalSteps={4} direction={direction} animKey={animKey}>
      {step === 2 && (
        <IncomeStep
          onNext={handleIncomeComplete}
          onSkip={() => goToStep(3)}
        />
      )}
      {step === 3 && (
        <AccountStep
          onNext={handleAccountComplete}
          onSkip={() => goToStep(4)}
        />
      )}
      {step === 4 && (
        <FeatureStep onComplete={handleFinish} />
      )}
    </OnboardingStep>
  );
}
