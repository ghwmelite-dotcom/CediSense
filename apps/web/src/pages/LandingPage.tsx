import { useEffect, useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProof } from '@/components/landing/SocialProof';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { Footer } from '@/components/landing/Footer';
import { KenteStripe } from '@/components/shared/KenteStripe';

/* ================================================================ */
/*  LANDING PAGE                                                     */
/* ================================================================ */
export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { resolved: currentTheme, toggle: toggleTheme } = useTheme();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [returnTo, setReturnTo] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Check URL params for auth modal
  useEffect(() => {
    const auth = searchParams.get('auth');
    const returnParam = searchParams.get('returnTo');
    if (auth === 'signin' || auth === 'register') {
      setAuthMode(auth);
      setAuthOpen(true);
      if (returnParam) setReturnTo(returnParam);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openAuth = useCallback((mode: 'signin' | 'register') => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    setAuthOpen(false);
    const destination = returnTo || '/dashboard';
    setReturnTo(null);
    // Delay navigation to let React flush the auth state update
    // Without this, ProtectedRoute sees isAuthenticated=false and redirects back to /login
    requestAnimationFrame(() => {
      navigate(destination);
    });
  }, [navigate, returnTo]);

  const scrollToFeatures = useCallback(() => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
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
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 15% 10%, rgba(255,107,53,0.06) 0%, transparent 55%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 85% 85%, rgba(0,200,150,0.04) 0%, transparent 50%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 40% 30% at 50% 50%, rgba(255,107,53,0.02) 0%, transparent 60%)' }} />
      </div>

      {/* --- Sticky navbar --- */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          background: 'var(--color-overlay)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-flame font-extrabold text-2xl leading-none">&#x20B5;</span>
            <span className="font-display font-semibold text-lg tracking-[-0.02em]" style={{ color: 'var(--color-text-primary)' }}>CediSense</span>
          </Link>
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: 'var(--color-hover-overlay)',
                border: '1px solid var(--color-border)',
              }}
            >
              {currentTheme === 'dark' ? (
                <svg className="w-[18px] h-[18px] text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px] text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>

            <button onClick={() => openAuth('signin')} className="text-sm font-medium text-muted hover:text-text-primary transition-colors duration-200 px-3 py-2">
              Sign In
            </button>
            <button
              onClick={() => openAuth('register')}
              className="text-sm px-5 py-2 hidden sm:inline-flex font-semibold text-white rounded-xl transition-all duration-200 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #FF6B35, #E85D2C)',
                boxShadow: '0 4px 15px rgba(255,107,53,0.25)',
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <HeroSection onOpenAuth={openAuth} onScrollToFeatures={scrollToFeatures} />

      {/* KenteStripe divider */}
      <KenteStripe className="max-w-6xl mx-auto" />

      <SocialProof />

      {/* KenteStripe divider */}
      <KenteStripe className="max-w-6xl mx-auto" />

      <FeatureGrid onOpenAuth={openAuth} onScrollToFeatures={scrollToFeatures} />

      {/* KenteStripe above footer */}
      <KenteStripe />

      <Footer />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
