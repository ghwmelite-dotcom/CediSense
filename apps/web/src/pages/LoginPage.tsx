import { useSearchParams, Navigate } from 'react-router-dom';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const authParam = returnTo ? `signin&returnTo=${encodeURIComponent(returnTo)}` : 'signin';
  return <Navigate to={`/?auth=${authParam}`} replace />;
}
