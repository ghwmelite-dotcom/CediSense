import { useState, useEffect, useRef, useCallback } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'register';
  onSuccess: () => void;
}

type AuthMode = 'signin' | 'register';

export function AuthModal({ open, onClose, initialMode = 'signin', onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [visible, setVisible] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync mode when initialMode prop changes
  useEffect(() => {
    if (open) setMode(initialMode);
  }, [initialMode, open]);

  // Handle open/close with animation
  useEffect(() => {
    if (open) {
      setVisible(true);
      setAnimatingOut(false);
      document.body.style.overflow = 'hidden';
    } else if (visible) {
      setAnimatingOut(true);
      const t = setTimeout(() => {
        setVisible(false);
        setAnimatingOut(false);
        document.body.style.overflow = '';
      }, 250);
      return () => clearTimeout(t);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!visible) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  // Focus trap
  useEffect(() => {
    if (!visible || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableSelector = 'input, button, [tabindex]:not([tabindex="-1"])';

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusable = modal.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [visible, mode]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  if (!visible) return null;

  const isIn = open && !animatingOut;

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'signin' ? 'Sign in to CediSense' : 'Create a CediSense account'}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-0 sm:px-4"
      onClick={handleBackdropClick}
      style={{
        backdropFilter: isIn ? 'blur(12px)' : 'blur(0px)',
        WebkitBackdropFilter: isIn ? 'blur(12px)' : 'blur(0px)',
        backgroundColor: isIn ? 'rgba(0,0,0,0.60)' : 'rgba(0,0,0,0)',
        transition: 'background-color 200ms ease-out, backdrop-filter 200ms ease-out, -webkit-backdrop-filter 200ms ease-out',
      }}
    >
      {/* Modal card */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
        style={{
          background: '#14142A',
          border: '1px solid rgba(212,168,67,0.08)',
          boxShadow: '0 0 80px rgba(212,168,67,0.08), 0 25px 60px rgba(0,0,0,0.5)',
          transform: isIn ? 'scale(1) translateY(0)' : 'scale(1) translateY(100%)',
          opacity: isIn ? 1 : 0,
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-muted-dim hover:text-text-primary hover:bg-white/[0.06] transition-all duration-200"
          aria-label="Close"
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-5 pt-6 pb-6 sm:px-8 sm:pt-8 sm:pb-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4">
              <div className="absolute inset-0 rounded-xl bg-gold/8 blur-xl scale-150 motion-safe:animate-glow-pulse" />
              <div className="relative w-full h-full rounded-xl bg-ghana-surface flex items-center justify-center shadow-card">
                <span className="text-gold font-extrabold text-2xl leading-none">&#x20B5;</span>
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-xl bg-white/[0.04] p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'signin' ? 'bg-gold/15 text-gold shadow-sm' : 'text-muted hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'register' ? 'bg-gold/15 text-gold shadow-sm' : 'text-muted hover:text-text-primary'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Forms with crossfade */}
          <div className="relative">
            <div key={mode} className="motion-safe:animate-fade-in">
              {mode === 'signin' ? (
                <LoginForm onSuccess={onSuccess} onSwitchMode={() => setMode('register')} />
              ) : (
                <RegisterForm onSuccess={onSuccess} onSwitchMode={() => setMode('signin')} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
