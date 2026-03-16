import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { CreditCertificate } from '@cedisense/shared';
import { CreditCertificateView } from '@/components/susu/CreditCertificateView';

const API_BASE = '/api/v1';

export function VerifyCertificatePage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [certificate, setCertificate] = useState<CreditCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!certificateId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function verify() {
      try {
        const response = await fetch(`${API_BASE}/susu/certificate/verify/${certificateId}`);
        if (!response.ok) {
          setNotFound(true);
          return;
        }
        const json = await response.json();
        setCertificate(json.data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    void verify();
  }, [certificateId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ghana-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-ghana-dark flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-white text-xl font-bold">Certificate Not Found</h1>
          <p className="text-muted text-sm max-w-xs">
            The certificate ID you provided is invalid or does not exist. Please double-check the verification code and try again.
          </p>
        </div>
        <Link
          to="/"
          className="px-5 py-3 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
            hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
        >
          Go to CediSense
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ghana-dark">
      {/* Simple header */}
      <div className="bg-ghana-dark/95 border-b border-white/10 px-4 py-4 print:hidden">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gold" aria-hidden="true">&#8373;</span>
            <span className="text-lg font-bold text-white">CediSense</span>
          </div>
          <Link
            to="/"
            className="px-4 py-2 rounded-xl border border-white/20 text-white text-sm font-medium
              hover:bg-white/10 active:scale-95 transition-all min-h-[44px] flex items-center"
          >
            Open App
          </Link>
        </div>
      </div>

      <CreditCertificateView certificate={certificate} isVerification />
    </div>
  );
}
