import { NavLink, Outlet, useNavigate } from 'react-router';
import { LogOut, Settings, ShoppingCart, User } from 'lucide-react';
import { useLogout, useMe } from '../api/hooks';
import { initials } from '../lib/format';

// Área da conta do Figma: sidebar com avatar, nome em laranja e menu; conteúdo à direita.
// Só é renderizada dentro do <ProtectedRoute>, então o usuário sempre existe aqui.
export function AccountLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!user) return null;
  const handleLogout = () => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });

  return (
    <div className="account">
      <aside className="account__sidebar" aria-label="Minha conta">
        <div className="avatar avatar--large" aria-hidden>
          {initials(user.name)}
        </div>
        <p className="account__name">{user.name}</p>

        <nav className="account__menu" aria-label="Menu da conta">
          <NavLink to="/profile" className="menu-item">
            <User size={20} aria-hidden /> Perfil
          </NavLink>
          <NavLink to="/reservations" className="menu-item">
            <ShoppingCart size={20} aria-hidden /> Minhas reservas
          </NavLink>
          {user.role === 'admin' && (
            <NavLink to="/admin/events" className="menu-item">
              <Settings size={20} aria-hidden /> Admin: eventos
            </NavLink>
          )}
          <button type="button" className="menu-item" onClick={handleLogout} disabled={logout.isPending}>
            <LogOut size={20} aria-hidden /> Sair
          </button>
        </nav>
      </aside>

      <div className="account__content">
        <Outlet />
      </div>
    </div>
  );
}
