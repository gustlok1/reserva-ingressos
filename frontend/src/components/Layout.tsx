import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { useMe } from '../api/hooks';
import { initials } from '../lib/format';

// Cabeçalho laranja do Figma (logo, menu, busca, login/avatar) + conteúdo + rodapé. Vale para todas as telas.
export function Layout() {
  const { data: user } = useMe();
  const location = useLocation();
  const [params] = useSearchParams();

  // A busca do cabeçalho acompanha a URL (ex.: ao usar o "voltar"): o `key` recria o campo quando o termo muda.
  const urlSearch = location.pathname === '/events' ? (params.get('search') ?? '') : '';

  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="header">
        <div className="header__inner">
          <Link to="/" className="logo" aria-label="Dry telecom, página inicial">
            <span className="logo__name">Dry</span>
            <span className="logo__sub">telecom</span>
          </Link>

          <nav className="nav" aria-label="Principal">
            <NavLink to="/" end className="button button--header">
              Início
            </NavLink>
            <NavLink to="/events" className="button button--header">
              Eventos
            </NavLink>
          </nav>

          <HeaderSearch key={urlSearch} initial={urlSearch} />

          <div className="header__right">
            {user ? (
              <Link to="/profile" className="avatar" aria-label={`Minha conta: ${user.name}`} title={user.name}>
                {initials(user.name)}
              </Link>
            ) : (
              <Link to="/login" state={{ from: location.pathname + location.search }} className="button button--header-dark">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="conteudo" className="page">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <span>2026 · Dry Telecom · Todos os direitos reservados · Barueri/SP</span>
          <span>Checkout seguro</span>
        </div>
      </footer>
    </>
  );
}

// Busca do cabeçalho: ao enviar (Enter), leva para /events?search=...
function HeaderSearch({ initial }: { initial: string }) {
  const [search, setSearch] = useState(initial);
  const navigate = useNavigate();

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/events?search=${encodeURIComponent(term)}` : '/events');
  };

  return (
    <form role="search" className="header-search" onSubmit={handleSearch}>
      <Search size={18} aria-hidden />
      <label htmlFor="busca" className="sr-only">
        Buscar eventos por nome
      </label>
      <input id="busca" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Busca por eventos..." />
    </form>
  );
}
