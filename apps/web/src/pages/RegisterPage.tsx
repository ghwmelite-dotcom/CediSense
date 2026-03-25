import { useSearchParams, Navigate } from 'react-router-dom';

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const authParam = returnTo ? `register&returnTo=${encodeURIComponent(returnTo)}` : 'register';
  return <Navigate to={`/?auth=${authParam}`} replace />;
}
