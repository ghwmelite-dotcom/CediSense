import { useState, useEffect } from 'react';
import type { CreditCertificate } from '@cedisense/shared';
import { api } from '@/lib/api';

function formatCurrency(pesewas: number): string {
  return (pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface CreditCertificateViewProps {
  /** If provided, renders in read-only verification mode */
  certificate?: CreditCertificate | null;
  /** If true, shows the "verified" badge */
  isVerification?: boolean;
  onClose?: () => void;
}

export function CreditCertificateView({ certificate: propCert, isVerification, onClose }: CreditCertificateViewProps) {
  const [cert, setCert] = useState<CreditCertificate | null>(propCert ?? null);
  const [loading, setLoading] = useState(!propCert);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propCert) {
      setCert(propCert);
      setLoading(false);
      return;
    }
    async function generate() {
      try {
        const data = await api.get<CreditCertificate>('/susu/certificate');
        setCert(data);
      } catch {
        setError('Could not generate certificate. Make sure you have susu history.');
      } finally {
        setLoading(false);
      }
    }
    void generate();
  }, [propCert]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
        <p className="text-muted text-sm">{error ?? 'Certificate not found'}</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl border border-white/20 text-white font-semibold text-sm
              hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  const scorePercent = Math.min(100, Math.max(0, cert.trust_score));
  const verifyUrl = `${window.location.origin}/verify/${cert.certificate_id}`;

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: 'CediSense Financial Discipline Certificate',
        text: `${cert!.user_name}'s verified financial discipline certificate with a Trust Score of ${cert!.trust_score}/100.`,
        url: verifyUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(verifyUrl).catch(() => {});
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(cert!.certificate_id).catch(() => {});
  }

  return (
    <div className="pb-24 print:pb-0">
      {/* Screen-only header */}
      {!isVerification && onClose && (
        <div className="sticky top-0 z-30 bg-ghana-dark/95 backdrop-blur-md border-b border-white/10 px-4 py-4 print:hidden">
          <div className="flex items-center gap-3 max-w-screen-lg mx-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/20
                text-white hover:bg-white/10 active:scale-95 transition-all min-h-[44px] min-w-[44px]"
              aria-label="Close certificate"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-white text-xl font-bold flex-1">Financial Certificate</h1>
          </div>
        </div>
      )}

      {/* Certificate card — white for print, dark-themed for screen */}
      <div className="px-4 pt-6 max-w-2xl mx-auto print:px-0 print:pt-0 print:max-w-none">
        <div
          className="bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:rounded-none"
          id="certificate-card"
        >
          {/* Gold header band */}
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-6 py-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-3xl font-bold text-amber-900" aria-hidden="true">&#8373;</span>
              <span className="text-2xl font-bold text-amber-900 tracking-wide">CediSense</span>
            </div>
            <h2 className="text-lg font-semibold text-amber-900/80 tracking-widest uppercase">
              Financial Discipline Certificate
            </h2>
          </div>

          {/* Verification badge */}
          {isVerification && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 flex items-center justify-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-emerald-700 font-semibold text-sm">
                This certificate was issued by CediSense
              </span>
            </div>
          )}

          <div className="px-6 py-8 space-y-8">
            {/* Separator */}
            <div className="border-t border-gray-200" />

            {/* Issued to */}
            <div className="text-center space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Issued to</p>
              <p className="text-2xl font-bold text-gray-900 uppercase tracking-wide">{cert.user_name}</p>
              <p className="text-sm text-gray-500">{cert.user_phone}</p>
              <p className="text-sm text-gray-500">{formatDate(cert.generated_at)}</p>
            </div>

            {/* Trust Score */}
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">Trust Score</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-extrabold text-amber-700">{cert.trust_score}</span>
                <span className="text-xl text-amber-600 font-medium">/ 100</span>
              </div>
              <p className="text-lg font-bold text-amber-800 uppercase tracking-wider">{cert.trust_label}</p>
              {/* Progress bar */}
              <div className="w-full bg-amber-200/60 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700"
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Groups Completed" value={String(cert.total_groups_completed)} />
              <StatItem label="Total Contributed" value={`\u20B5${formatCurrency(cert.total_contributed_pesewas)}`} />
              <StatItem label="On-Time Rate" value={`${cert.on_time_rate}%`} />
              <StatItem label="Current Streak" value={`${cert.current_streak} consecutive`} />
              <StatItem label="Longest Streak" value={`${cert.longest_streak} consecutive`} />
              <StatItem label="Member Since" value={formatDate(cert.member_since)} />
            </div>

            {/* Badges */}
            {cert.badges_earned.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Badges Earned</p>
                <div className="flex flex-wrap gap-2">
                  {cert.badges_earned.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800
                        rounded-full text-xs font-semibold border border-amber-200"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <p className="text-sm text-gray-700 leading-relaxed">{cert.summary}</p>
            </div>

            {/* Verification section */}
            <div className="border-t border-gray-200 pt-6 text-center space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Verification Code</p>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300
                  rounded-lg font-mono text-sm text-gray-800 hover:bg-gray-200 active:scale-95 transition-all
                  min-h-[44px] print:border-none print:bg-transparent print:hover:bg-transparent"
                title="Click to copy"
              >
                {cert.certificate_id}
                <svg className="w-4 h-4 text-gray-400 print:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <p className="text-xs text-gray-500">
                Verify at: <span className="font-mono text-gray-600 break-all">{verifyUrl}</span>
              </p>
            </div>

            {/* Footer */}
            <div className="text-center pt-2">
              <p className="text-xs text-gray-400">Built by Hodges &amp; Co. &mdash; CediSense</p>
            </div>
          </div>
        </div>

        {/* Action buttons — screen only */}
        <div className="flex items-center justify-center gap-3 mt-6 print:hidden">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gold text-ghana-dark
              font-semibold text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/20 text-white
              font-semibold text-sm hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/20 text-white
              font-semibold text-sm hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
