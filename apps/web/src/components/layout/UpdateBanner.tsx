import { useState, useEffect, useCallback } from 'react';

export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('sw-update-waiting', handler);
    return () => window.removeEventListener('sw-update-waiting', handler);
  }, []);

  const handleRefresh = useCallback(() => {
    const reg = navigator.serviceWorker?.controller;
    // Tell the waiting SW to skip waiting — controllerchange listener in main.tsx will reload
    navigator.serviceWorker?.getRegistration().then((registration) => {
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
    // If no controllerchange fires within 2s, force reload as fallback
    setTimeout(() => window.location.reload(), 2000);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-3
        bg-ghana-gold/95 text-ghana-dark px-4 py-2 text-sm font-medium"
      role="alert"
    >
      <span>A new version of CediSense is available.</span>
      <button
        onClick={handleRefresh}
        className="bg-ghana-dark text-white text-xs font-semibold
          rounded-lg px-3 py-1 hover:bg-ghana-dark/80 transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}
