import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KenteStripe } from '@/components/shared/KenteStripe';

const UPDATED = 'August 2026';
const CONTACT = 'support@cedisense.com';

function LegalLayout({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'var(--color-overlay)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-flame font-extrabold text-2xl leading-none">&#x20B5;</span>
            <span className="font-display font-semibold text-lg tracking-[-0.02em]">CediSense</span>
          </Link>
          <Link to="/" className="text-sm text-theme-text-secondary hover:text-flame transition-colors duration-200">
            &larr; Back to home
          </Link>
        </div>
      </header>
      <KenteStripe />

      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2">{title}</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>Last updated {UPDATED}</p>
        <p className="text-base leading-relaxed mb-10" style={{ color: 'var(--color-text-secondary)' }}>{intro}</p>
        <div className="space-y-8">{children}</div>
        <p className="mt-12 pt-6 text-sm leading-relaxed" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          Questions? Reach us at{' '}
          <a href={`mailto:${CONTACT}`} className="text-flame hover:underline">{CONTACT}</a>.
        </p>
      </main>

      <footer className="px-6 py-8" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <span>&copy; {new Date().getFullYear()} CediSense</span>
          <span className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-flame transition-colors duration-200">Privacy</Link>
            <Link to="/terms" className="hover:text-flame transition-colors duration-200">Terms</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold mb-2.5">{heading}</h2>
      <div className="space-y-3 leading-relaxed text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
        {children}
      </div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="CediSense is a personal-finance companion built for Ghana. We keep the data we collect to the minimum needed to run the app, and we never sell it. This policy explains what we collect, how we use it, and the choices you have."
    >
      <Section heading="Information we collect">
        <p>When you create an account we collect your name and mobile number, and a securely hashed version of your PIN — we never store your PIN in readable form.</p>
        <p>We store the financial information you choose to add: transactions, budgets, goals, investments, Susu group activity, and any Mobile Money SMS you paste or import so we can parse it into transactions.</p>
        <p>We also collect basic technical data (device type, app version, and diagnostic logs) to keep the service reliable.</p>
      </Section>
      <Section heading="What we do not collect">
        <p>CediSense does not ask for or store your bank or Mobile Money login credentials. You stay in control — the app works from information you enter or paste, not by logging into your accounts.</p>
      </Section>
      <Section heading="How we use your information">
        <p>We use your data to operate the app, personalise your dashboard and budgets, generate insights, and provide the AI assistant and Susu features you use.</p>
      </Section>
      <Section heading="AI processing">
        <p>When you use the AI assistant, the messages and relevant financial context you send are processed by AI service providers to generate a response. Do not share information in the assistant that you would not want processed this way.</p>
      </Section>
      <Section heading="Storage and security">
        <p>Your data is stored on Cloudflare's infrastructure and transmitted over encrypted (HTTPS) connections. Access is restricted and PINs are stored only as salted hashes.</p>
      </Section>
      <Section heading="Sharing">
        <p>We do not sell your personal data. We share it only with the service providers needed to run CediSense (such as hosting and AI providers), and where required by law.</p>
      </Section>
      <Section heading="Your choices">
        <p>You can view and edit your information in the app, and you can request export or deletion of your account and associated data at any time by contacting us.</p>
      </Section>
      <Section heading="Children">
        <p>CediSense is intended for users aged 18 and over and is not directed at children.</p>
      </Section>
      <Section heading="Changes to this policy">
        <p>We may update this policy as the product evolves. Material changes will be reflected here with a new &ldquo;last updated&rdquo; date.</p>
      </Section>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro="These terms govern your use of CediSense. By creating an account or using the app, you agree to them. Please read them together with our Privacy Policy."
    >
      <Section heading="Eligibility and your account">
        <p>You must be at least 18 years old to use CediSense. Keep your PIN confidential — you are responsible for activity that happens under your account. Tell us promptly if you suspect unauthorised access.</p>
      </Section>
      <Section heading="Not financial advice">
        <p>CediSense provides budgeting tools and AI-generated insights for informational purposes only. They are not professional financial, investment, tax, or legal advice. You are responsible for your own financial decisions, and should consult a qualified professional where appropriate.</p>
      </Section>
      <Section heading="Acceptable use">
        <p>Use CediSense lawfully and respectfully. Do not misuse the service, attempt to disrupt it, or use Susu groups and chat to harass others, share unlawful content, or defraud anyone.</p>
      </Section>
      <Section heading="Susu groups and community content">
        <p>Content you post in Susu groups and chat is your responsibility. Group organisers and members are responsible for their own arrangements; CediSense provides the tools but is not a party to your Susu agreements.</p>
      </Section>
      <Section heading="Availability">
        <p>The service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We work to keep it reliable, but features may change and access may occasionally be interrupted.</p>
      </Section>
      <Section heading="Limitation of liability">
        <p>To the extent permitted by law, CediSense and its makers are not liable for indirect or consequential losses arising from your use of the app, including financial decisions made using its insights.</p>
      </Section>
      <Section heading="Termination">
        <p>You may stop using CediSense and request deletion of your account at any time. We may suspend or end access where these terms are breached.</p>
      </Section>
      <Section heading="Changes to these terms">
        <p>We may update these terms as the product evolves. Continued use after an update means you accept the revised terms.</p>
      </Section>
    </LegalLayout>
  );
}
