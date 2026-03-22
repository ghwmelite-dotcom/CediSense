import { useEffect, useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Check URL params for auth modal
  useEffect(() => {
    const auth = searchParams.get('auth');
    if (auth === 'signin' || auth === 'register') {
      setAuthMode(auth);
      setAuthOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openAuth = useCallback((mode: 'signin' | 'register') => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    setAuthOpen(false);
    navigate('/dashboard');
  }, [navigate]);

  const scrollToFeatures = useCallback(() => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-ghana-dark text-text-primary overflow-x-hidden">
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
          background: 'rgba(12,12,20,0.75)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-flame font-extrabold text-2xl leading-none">&#x20B5;</span>
            <span className="text-text-primary font-display font-semibold text-lg tracking-[-0.02em]">CediSense</span>
          </Link>
          <div className="flex items-center gap-3">
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
