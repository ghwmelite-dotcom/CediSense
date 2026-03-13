import { Routes, Route } from 'react-router-dom';

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted text-lg">{name} — coming soon</p>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Placeholder name="Login" />} />
      <Route path="/register" element={<Placeholder name="Register" />} />
      <Route path="/" element={<Placeholder name="Dashboard" />} />
    </Routes>
  );
}
