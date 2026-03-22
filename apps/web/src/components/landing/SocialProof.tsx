export function SocialProof() {
  return (
    <section className="relative py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-muted-dim text-xs uppercase tracking-widest mb-6">Trusted by Ghanaians</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x md:divide-white/[0.06]">
          {[
            { value: '11', label: 'Providers' },
            { value: '10', label: 'Susu Types' },
            { value: 'AI', label: 'Powered' },
            { value: '100%', label: 'Free' },
          ].map((stat) => (
            <div key={stat.label} className="text-center px-4">
              <p className="text-xl md:text-2xl font-extrabold text-text-primary tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
