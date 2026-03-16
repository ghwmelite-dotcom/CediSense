import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'cedisense-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      // Delay showing by 30 seconds so we don't interrupt immediately
      const timer = setTimeout(() => setShow(true), 30_000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    setPrompt(null);
    setShow(false);
  }, [prompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }, []);

  if (!show || !prompt) return null;

  return (
    <div
      className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-80
        bg-ghana-surface border border-white/10 rounded-2xl p-4 shadow-xl z-50
        animate-fade-in"
      role="banner"
      aria-label="Install CediSense"
    >
      <p className="font-semibold text-sm text-white">Install CediSense</p>
      <p className="text-muted text-xs mt-1">
        Add to your home screen for the best experience
      </p>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleInstall}
          className="flex-1 bg-ghana-gold text-ghana-dark font-semibold text-sm
            rounded-lg px-4 py-2 hover:bg-ghana-gold/90 transition-colors"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="text-muted text-sm px-3 hover:text-white/70 transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}
