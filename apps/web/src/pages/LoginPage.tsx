import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/?auth=signin', { replace: true });
  }, [navigate]);

  return null;
}
