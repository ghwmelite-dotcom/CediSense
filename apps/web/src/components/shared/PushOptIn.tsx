import { useState, useEffect } from 'react';
import { usePushSubscription } from '../../hooks/usePushSubscription';

const DISMISS_KEY = 'cedisense-push-optin-dismissed';

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * Sleek opt-in prompt for push notifications, shown once when the user is
 * authenticated and hasn't decided yet. On iOS (where web push requires an
 * installed PWA), it shows Add-to-Home-Screen guidance instead.
 */
export function PushOptIn() {
  const { isSupported, permission, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true); // hidden until checked
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (!isSupported || dismissed || permission !== 'default') return null;

  const iosNotInstalled = isIOS() && !isStandalone();

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  async function enable() {
    setEnabling(true);
    try {
      await subscribe();
    } finally {
      setEnabling(false);
    }
  }

  return (
    <div className="mx-4 mb-3 bg-gradient-to-r from-gold/20 via-ghana-surface to-gold/20 border border-gold/40 rounded-xl p-4 space-y-3 max-w-screen-lg lg:mx-auto">
      <div className="flex items-start justify-between gap-3">
        <p className="text-gold font-semibold text-sm">
          {iosNotInstalled ? '📲 Get CediSense on your home screen' : '🔔 Never miss your round'}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="text-muted hover:text-white transition-colors p-1 -m-1"
          aria-label="Dismiss notification prompt"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {iosNotInstalled ? (
        <>
          <p className="text-white/80 text-xs leading-relaxed">
            On iPhone, CediSense can send payout and contribution reminders once installed:
            tap <span className="font-semibold text-white">Share</span> in Safari, then
            <span className="font-semibold text-white"> Add to Home Screen</span>, and enable
            notifications inside the app.
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="w-full px-4 py-2.5 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
          >
            Got it
          </button>
        </>
      ) : (
        <>
          <p className="text-white/80 text-xs leading-relaxed">
            Payout-day alerts, contribution reminders, and streak warnings — straight to your
            lock screen, even when the app is closed.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={enable}
              disabled={enabling}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gold text-ghana-dark text-sm font-bold hover:brightness-110 active:scale-95 transition-all min-h-[44px] disabled:opacity-50"
            >
              {enabling ? 'Enabling…' : 'Enable notifications'}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="px-4 py-2.5 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
            >
              Later
            </button>
          </div>
        </>
      )}
    </div>
  );
}
