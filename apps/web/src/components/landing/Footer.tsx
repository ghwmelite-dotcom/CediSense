import { AdinkraWhisper } from '@/components/shared/AdinkraWhisper';

export function Footer() {
  return (
    <footer className="relative py-14 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="text-flame font-extrabold text-xl leading-none">&#x20B5;</span>
            <span className="text-text-primary font-display font-semibold tracking-[-0.02em]">CediSense</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#" className="text-muted-dim hover:text-muted text-sm transition-colors duration-200">Privacy</a>
            <a href="#" className="text-muted-dim hover:text-muted text-sm transition-colors duration-200">Terms</a>
          </div>
        </div>
        <div className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-muted-dim/50 text-sm">
            Built with care by <span className="text-muted-dim">Hodges &amp; Co.</span>
          </p>
          <p className="text-muted-dim/50 text-sm flex items-center gap-1.5">
            Made in Ghana <span role="img" aria-label="Ghana flag">&#x1F1EC;&#x1F1ED;</span>
          </p>
        </div>

        {/* Adinkra whisper */}
        <div className="mt-8">
          <AdinkraWhisper symbol="gye-nyame" />
        </div>
      </div>
    </footer>
  );
}
