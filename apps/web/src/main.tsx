import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { App } from './App';
import './styles/globals.css';

// Shared query client. `refetchOnWindowFocus` is the key behaviour: any screen
// built on `useQuery` auto-refreshes when the user returns to the app — no more
// "close and reopen to see the change". `staleTime` keeps rapid re-focuses from
// hammering the API.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Check for updates every 60 minutes
        setInterval(() => registration.update(), 60 * 60 * 1000);

        // Detect waiting SW on initial load
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent('sw-update-waiting'));
        }

        // Listen for new service worker installing
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version installed and waiting — notify UI
              window.dispatchEvent(new CustomEvent('sw-update-waiting'));
            }
          });
        });
      })
      .catch(() => {
        // SW registration failed — non-critical, app works without it
      });
  });

  // Reload when a new SW takes control
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
