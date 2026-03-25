import { Routes, Route } from 'react-router-dom';
import { AdminShell } from '@/components/layout/AdminShell';
import { AdminProtectedRoute } from '@/components/layout/AdminProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';

// Placeholder pages for now
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <AdminProtectedRoute>
            <AdminShell />
          </AdminProtectedRoute>
        }
      >
        <Route index element={<PlaceholderPage title="Dashboard" />} />
        <Route path="users" element={<PlaceholderPage title="Users" />} />
        <Route path="users/:id" element={<PlaceholderPage title="User Detail" />} />
        <Route path="groups" element={<PlaceholderPage title="Groups" />} />
        <Route path="groups/:id" element={<PlaceholderPage title="Group Detail" />} />
        <Route path="audit-log" element={<PlaceholderPage title="Audit Log" />} />
      </Route>
    </Routes>
  );
}
