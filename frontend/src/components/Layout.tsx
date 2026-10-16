import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { useLogout, useMe } from '../api/hooks';

// Cabeçalho laranja do design system + área de conteúdo das telas logadas.
export function Layout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });

  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="header">
        <div className="header__inner">
          <Link to="/events" className="logo" aria-label="Dry telecom, página inicial">
            <span className="logo__name">Dry</span>
            <span className="logo__sub">telecom</span>
          </Link>

          <nav className="nav" aria-label="Principal">
            <NavLink to="/events" className="button button--header">
              Eventos
            </NavLink>
            <NavLink to="/reservations" className="button button--header">
              Minhas reservas
            </NavLink>
          </nav>

          <div className="header__user">
            <span>{user?.name}</span>
            <button type="button" className="button button--header" onClick={handleLogout} disabled={logout.isPending}>
              <LogOut size={16} aria-hidden />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main id="conteudo" className="page">
        <Outlet />
      </main>
    </>
  );
}
