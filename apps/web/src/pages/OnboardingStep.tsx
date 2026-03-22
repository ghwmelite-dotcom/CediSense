import type { ReactNode } from 'react';

const STEP_LABELS = ['Welcome', 'Income', 'Account', 'Get Started'];

/* ─── Particle Background ────────────────────────────────────────────────── */

export function GoldParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-gold/40 motion-safe:animate-gold-float"
          style={{
            left: `${8 + (i * 7.5) % 84}%`,
            bottom: `${10 + (i * 13) % 30}%`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${2.5 + (i % 3) * 0.8}s`,
          }}
        />
      ))}
      {/* Central gold glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full motion-safe:animate-glow-pulse"
        style={{ background: 'radial-gradient(circle, rgba(212,168,67,0.08) 0%, transparent 70%)' }}
      />
    </div>
  );
}

/* ─── Step Indicator ─────────────────────────────────────────────────────── */

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8 motion-safe:animate-fade-in">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const stepNum = i + 1;
        const isComplete = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex items-center justify-center rounded-full font-semibold text-xs transition-all duration-500 ${
                  isComplete
                    ? 'w-7 h-7 bg-gold text-ghana-dark'
                    : isCurrent
                      ? 'w-8 h-8 bg-gold text-ghana-dark shadow-gold-glow'
                      : 'w-7 h-7 bg-ghana-surface text-muted-dim'
                }`}
              >
                {isComplete ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`text-[9px] font-semibold tracking-wider uppercase transition-colors duration-300 hidden sm:block ${
                  stepNum <= currentStep ? 'text-text-primary' : 'text-muted-dim/40'
                }`}
              >
                {STEP_LABELS[i]}
              </span>
            </div>
            {i < totalSteps - 1 && (
              <div className="w-8 h-[2px] mb-4 sm:mb-0 relative overflow-hidden rounded-full bg-ghana-surface">
                <div
                  className="absolute inset-y-0 left-0 bg-gold transition-all duration-700 ease-out rounded-full"
                  style={{ width: stepNum < currentStep ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Onboarding Step Wrapper ────────────────────────────────────────────── */

interface OnboardingStepProps {
  /** The step number (1-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** The slide animation direction */
  direction: 'left' | 'right';
  /** Animation key for re-rendering */
  animKey: number;
  /** The step content to render */
  children: ReactNode;
}

/**
 * Reusable step card component that wraps each onboarding step with:
 * - Branding logo
 * - Step indicator (progress dots with labels)
 * - Slide animation
 * - Step progress text
 * - Footer
 */
export function OnboardingStep({ currentStep, totalSteps, direction, animKey, children }: OnboardingStepProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-ghana-dark relative overflow-hidden">
      {/* Ambient gradients */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 30% -10%, rgba(212,168,67,0.06) 0%, transparent 60%)' }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 70% 110%, rgba(52,211,153,0.04) 0%, transparent 60%)' }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Branding */}
        <div className="text-center mb-6 motion-safe:animate-fade-in">
          <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4">
            <div className="absolute inset-0 rounded-2xl bg-gold/8 blur-xl scale-[2] motion-safe:animate-glow-pulse" />
            <div className="relative w-full h-full rounded-2xl bg-ghana-surface flex items-center justify-center shadow-card">
              <span className="text-gold font-extrabold text-2xl leading-none">{'\u20B5'}</span>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />

        {/* Step content with slide animation */}
        <div
          key={animKey}
          className={`motion-safe:${direction === 'left' ? 'animate-slide-left' : 'animate-slide-right'}`}
        >
          {children}
        </div>

        {/* Step progress */}
        <p className="text-center text-muted-dim/40 text-xs mt-8 tracking-wide">
          Step {currentStep} of {totalSteps}
        </p>
      </div>

      {/* Footer */}
      <p className="mt-auto pt-10 pb-6 text-muted-dim/25 text-xs tracking-wider">
        Built by Hodges &amp; Co.
      </p>
    </div>
  );
}
