import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'cedisense-install-dismissed';
const INSTALLED_KEY = 'cedisense-installed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Detect if running as installed PWA already */
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Detect iOS Safari */
function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    // Already installed — never show
    if (isStandalone() || localStorage.getItem(INSTALLED_KEY)) return;

    // Dismissed recently — don't show yet
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) return;

    // Listen for Android/Desktop install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 30_000);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Track successful installs — hide forever after
    const installHandler = () => {
      localStorage.setItem(INSTALLED_KEY, 'true');
      setShow(false);
      setPrompt(null);
    };
    window.addEventListener('appinstalled', installHandler);

    // iOS doesn't fire beforeinstallprompt — show manual instructions instead
    if (isIOS() && !isStandalone()) {
      setIsIOSDevice(true);
      setTimeout(() => setShow(true), 30_000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!prompt) return;
    const result = await prompt.prompt();
    if (result.outcome === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, 'true');
    }
    setPrompt(null);
    setShow(false);
  }, [prompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-80
        rounded-2xl p-4 shadow-xl z-50 motion-safe:animate-slide-up"
      style={{
        background: '#14142A',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
      role="banner"
      aria-label="Install CediSense"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(212,168,67,0.15) 0%, rgba(212,168,67,0.05) 100%)' }}>
          <span className="text-gold font-extrabold text-lg">₵</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-text-primary">Install CediSense</p>
          {isIOSDevice ? (
            <p className="text-muted text-xs mt-1 leading-relaxed">
              Tap <span className="inline-block align-text-bottom">
                <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </span> Share then <strong>"Add to Home Screen"</strong>
            </p>
          ) : (
            <p className="text-muted text-xs mt-1">
              Add to your home screen for offline access and the best experience
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        {!isIOSDevice && prompt && (
          <button
            onClick={handleInstall}
            className="flex-1 font-semibold text-sm rounded-xl px-4 py-2.5 transition-all duration-200 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #E8C873 0%, #D4A843 50%, #C49A3C 100%)',
              color: '#0C0C14',
              boxShadow: '0 2px 8px rgba(212,168,67,0.3)',
            }}
          >
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="text-muted text-sm px-4 py-2.5 hover:text-text-primary transition-colors rounded-xl"
        >
          {isIOSDevice ? 'Got it' : 'Later'}
        </button>
      </div>
    </div>
  );
}
