import { Routes, Route } from 'react-router-dom';
import { AdminShell } from '@/components/layout/AdminShell';
import { AdminProtectedRoute } from '@/components/layout/AdminProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';
import { UserDetailPage } from '@/pages/UserDetailPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';

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
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="groups/:id" element={<GroupDetailPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
      </Route>
    </Routes>
  );
}
