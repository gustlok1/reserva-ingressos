import { Route, Routes } from 'react-router';
import { AccountLayout } from './components/AccountLayout';
import { AdminRoute } from './components/AdminRoute';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EmptyState } from './components/ui';
import { AdminEventFormPage } from './pages/AdminEventFormPage';
import { AdminEventsPage } from './pages/AdminEventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { EventsPage } from './pages/EventsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MyReservationsPage } from './pages/MyReservationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ReservationPage } from './pages/ReservationPage';

export function App() {
  return (
    <Routes>
      {/* O cabeçalho aparece em todas as telas; o catálogo é público. */}
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* Área logada, com a sidebar da conta. */}
        <Route
          element={
            <ProtectedRoute>
              <AccountLayout />
            </ProtectedRoute>
          }
        >
          <Route path="profile" element={<ProfilePage />} />
          <Route path="reservations" element={<MyReservationsPage />} />
          <Route path="reservations/:id" element={<ReservationPage />} />
          <Route
            path="admin/events"
            element={
              <AdminRoute>
                <AdminEventsPage />
              </AdminRoute>
            }
          />
          <Route
            path="admin/events/new"
            element={
              <AdminRoute>
                <AdminEventFormPage />
              </AdminRoute>
            }
          />
          <Route
            path="admin/events/:id"
            element={
              <AdminRoute>
                <AdminEventFormPage />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<EmptyState>Página não encontrada.</EmptyState>} />
      </Route>
    </Routes>
  );
}
