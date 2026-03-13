import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

export function LoginPage() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ phone: phone.replace(/\s|-/g, ''), pin });
      navigate('/');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-ghana-black">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-gold font-extrabold text-4xl">₵</span>
          <h1 className="text-white text-2xl font-bold mt-2">Welcome back</h1>
          <p className="text-muted text-sm mt-1">Sign in to your CediSense account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-expense/10 border border-expense/30 text-expense text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm text-muted block mb-1.5">Phone Number</label>
            <input
              type="tel"
              placeholder="024 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-ghana-surface border border-ghana-surface text-white rounded-lg px-4 py-3 text-base focus:outline-none focus:border-gold"
              required
            />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1.5">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full bg-ghana-surface border border-ghana-surface text-white rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-gold"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full bg-ghana-green text-white font-semibold py-3 rounded-lg hover:bg-ghana-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-gold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
