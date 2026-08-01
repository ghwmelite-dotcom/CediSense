import { Link } from 'react-router-dom';
import { GhanaFlag } from '@/components/shared/GhanaFlag';
import { AdinkraWhisper } from '@/components/shared/AdinkraWhisper';

const YEAR = new Date().getFullYear();

const linkClass =
  'text-theme-text-secondary hover:text-flame transition-colors duration-200';

export function Footer() {
  return (
    <footer
      className="relative overflow-hidden px-6 pt-16 pb-10"
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'linear-gradient(180deg, transparent 0%, var(--color-hover-overlay) 100%)',
      }}
    >
      {/* Warm ambient glow bleeding down from the pricing section above */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-16 h-40"
        style={{ background: 'var(--gradient-glow-orange)' }}
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Top — brand + link groups */}
        <div className="grid grid-cols-2 md:grid-cols-[1.7fr_1fr_1fr] gap-x-8 gap-y-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 max-w-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-flame font-extrabold text-2xl leading-none">&#x20B5;</span>
              <span className="text-text-primary font-display font-semibold text-lg tracking-[-0.02em]">
                CediSense
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              AI-powered personal finance, built for Ghana. Track Mobile Money, budget in
              cedis, and grow your savings &mdash; all in one place.
            </p>
          </div>

          {/* Explore */}
          <nav aria-label="Explore">
            <h3 className="section-label mb-4">Explore</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="#features" className={linkClass}>Features</a></li>
              <li><Link to="/?auth=register" className={linkClass}>Get started free</Link></li>
              <li><Link to="/?auth=signin" className={linkClass}>Sign in</Link></li>
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label="Legal">
            <h3 className="section-label mb-4">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className={linkClass}>Privacy</a></li>
              <li><a href="#" className={linkClass}>Terms</a></li>
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-14 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <p className="text-sm text-center sm:text-left" style={{ color: 'var(--color-text-muted)' }}>
            &copy; {YEAR} CediSense &middot; Built with care by{' '}
            <span style={{ color: 'var(--color-text-secondary)' }}>Hodges &amp; Co.</span>
          </p>
          <span
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Made in Ghana <GhanaFlag size="sm" />
          </span>
        </div>

        {/* Cultural signature */}
        <div className="mt-8">
          <AdinkraWhisper symbol="gye-nyame" />
        </div>
      </div>
    </footer>
  );
}
