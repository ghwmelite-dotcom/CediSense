import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiRequestError } from '@/lib/api';

type JoinStatus = 'idle' | 'joining' | 'success' | 'error';
type JoinErrorType = 'invalid' | 'full' | 'already_member' | 'no_code' | 'unknown';

function getErrorMessage(errorType: JoinErrorType): string {
  switch (errorType) {
    case 'invalid':
      return 'This invite code is invalid or has expired. Please ask the group creator for a new link.';
    case 'full':
      return 'This susu group is already full and cannot accept new members.';
    case 'already_member':
      return 'You are already a member of this group.';
    case 'no_code':
      return 'No invite code was provided. Please use a valid invite link.';
    case 'unknown':
    default:
      return 'Something went wrong. Please try again or enter the code manually.';
  }
}

function mapApiError(err: unknown): JoinErrorType {
  if (err instanceof ApiRequestError) {
    if (err.code === 'INVALID_INVITE' || err.status === 404) return 'invalid';
    if (err.code === 'GROUP_FULL') return 'full';
    if (err.code === 'ALREADY_MEMBER' || err.status === 409) return 'already_member';
  }
  return 'unknown';
}

export function JoinByLinkPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  const code = searchParams.get('code');

  const [status, setStatus] = useState<JoinStatus>('idle');
  const [errorType, setErrorType] = useState<JoinErrorType>('unknown');

  useEffect(() => {
    if (isLoading) return;

    if (!code) {
      setStatus('error');
      setErrorType('no_code');
      return;
    }

    if (!isAuthenticated) return; // Show sign-in prompt

    // Auto-join
    let cancelled = false;
    async function attemptJoin() {
      setStatus('joining');
      try {
        const result = await api.post<{ group_id: string }>('/susu/groups/join', { invite_code: code });
        if (!cancelled) {
          const groupId = result?.group_id;
          setStatus('success');
          // Navigate to the specific susu group after brief delay
          setTimeout(() => {
            if (!cancelled) navigate(groupId ? `/susu?group=${groupId}` : '/susu', { replace: true });
          }, 1500);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorType(mapApiError(err));
        }
      }
    }
    attemptJoin();
    return () => { cancelled = true; };
  }, [code, isAuthenticated, isLoading, navigate]);

  // Loading auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-ghana-dark flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — show sign-in prompt
  if (!isAuthenticated) {
    const returnUrl = `/join?code=${encodeURIComponent(code ?? '')}`;

    return (
      <div className="min-h-screen bg-ghana-dark flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-ghana-surface border border-white/10 rounded-2xl p-6 space-y-5 text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <div className="space-y-1">
            <h1 className="text-white text-xl font-bold">You've been invited!</h1>
            <p className="text-muted text-sm mt-2">
              Create a free account to join this Susu group. You'll be added automatically after signing up.
            </p>
            {code && (
              <p className="text-gold font-mono text-xs mt-2">
                Code: {code}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to={`/register?returnTo=${encodeURIComponent(returnUrl)}`}
              className="w-full flex items-center justify-center px-4 py-3 rounded-xl
                bg-gold text-ghana-dark font-semibold text-sm hover:brightness-110
                active:scale-95 transition-all min-h-[44px]"
            >
              Create Account
            </Link>
            <Link
              to={`/login?returnTo=${encodeURIComponent(returnUrl)}`}
              className="w-full flex items-center justify-center px-4 py-3 rounded-xl
                border border-white/20 text-white font-semibold text-sm
                hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Joining in progress
  if (status === 'joining' || status === 'idle') {
    return (
      <div className="min-h-screen bg-ghana-dark flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white font-semibold">Joining group...</p>
          <p className="text-muted text-sm">Code: {code}</p>
        </div>
      </div>
    );
  }

  // Success
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-ghana-dark flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-income/15 border border-income/30 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-income" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-bold text-lg">You're in!</p>
          <p className="text-muted text-sm">Redirecting to your susu groups...</p>
        </div>
      </div>
    );
  }

  // Error
  return (
    <div className="min-h-screen bg-ghana-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-ghana-surface border border-white/10 rounded-2xl p-6 space-y-5 text-center">
        <div className="w-14 h-14 rounded-full bg-expense/15 border border-expense/30 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-expense" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="space-y-1">
          <h1 className="text-white text-lg font-bold">Couldn't Join Group</h1>
          <p className="text-muted text-sm">{getErrorMessage(errorType)}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/susu"
            className="w-full flex items-center justify-center px-4 py-3 rounded-xl
              bg-gold text-ghana-dark font-semibold text-sm hover:brightness-110
              active:scale-95 transition-all min-h-[44px]"
          >
            Go to Susu Groups
          </Link>
          <Link
            to="/"
            className="w-full flex items-center justify-center px-4 py-3 rounded-xl
              border border-white/20 text-white font-semibold text-sm
              hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
