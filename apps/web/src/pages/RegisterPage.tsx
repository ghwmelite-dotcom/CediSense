import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function RegisterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/?auth=register', { replace: true });
  }, [navigate]);

  return null;
}
