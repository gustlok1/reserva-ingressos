import { Link } from 'react-router';
import { CheckCircle2, Headphones, Infinity as InfinityIcon, MapPin, RefreshCcw, Search, Timer, TrendingUp, Wifi } from 'lucide-react';
import { useEvents, useMe } from '../api/hooks';
import { EventCard } from '../components/EventCard';
import { EmptyState, ErrorState, LoadingState } from '../components/ui';
import { formatLongDate } from '../lib/format';

// Textos institucionais retirados do site da Dry Telecom (drytelecom.com.br). Projeto de estudo, não é produção.

const BENEFITS = [
  { icon: TrendingUp, title: 'GB que acumulam', text: 'Acumule seus GB e minutos não utilizados.' },
  {
    icon: Headphones,
    title: 'Atendimento 24 horas',
    text: 'Fale em nosso chat online e humanizado, ou ligue para nossa Central de atendimento pelos números *288 e 10543.',
  },
  { icon: RefreshCcw, title: 'Bônus de internet sempre', text: 'Tenha muito mais internet com os nossos bônus de recarga programada e de portabilidade.' },
  { icon: InfinityIcon, title: 'Apps ilimitados', text: 'Acesse WhatsApp e Waze sem limites, sem descontar da sua franquia de internet.' },
];

const PASSIONS = ['Laricel', 'Fala Mangueira', 'Botafogo Celular', 'Chipeixão', 'Grêmio Cell', 'Chip do Papão'];

const STEPS = [
  { icon: Search, title: 'Escolha o evento', text: 'Veja datas, locais e quantos ingressos ainda estão disponíveis.' },
  { icon: Timer, title: 'Reserve', text: 'Seus ingressos ficam guardados por alguns minutos enquanto você decide.' },
  { icon: CheckCircle2, title: 'Confirme', text: 'Finalize a compra dentro do prazo e pronto: seu lugar está garantido.' },
];

// Home pública: vitrine da marca. O catálogo completo (busca e paginação) fica em /events.
export function HomePage() {
  const { data: user } = useMe();
  const events = useEvents({ search: '', page: 1, pageSize: 3 });

  if (events.isPending) return <LoadingState label="Carregando eventos..." />;
  if (events.isError) return <ErrorState error={events.error} onRetry={() => events.refetch()} />;

  const list = events.data.data;
  if (list.length === 0) return <EmptyState>Nenhum evento cadastrado.</EmptyState>;

  // Destaque: o primeiro evento que ainda dá para comprar (ou o primeiro da lista, se todos esgotaram).
  const featured = list.find((e) => !e.hasStarted && e.available > 0) ?? list[0]!;

  return (
    <>
      <section className="hero" aria-labelledby="destaque">
        <img className="hero__image" src={featured.imageUrl} alt="" />
        <div className="hero__content">
          <h1 id="destaque" className="hero__title">
            {featured.name}
          </h1>
          <p className="hero__subtitle">
            {featured.subtitle ? `${featured.subtitle} · ` : ''}
            {featured.venue}
          </p>
          <div className="row">
            <Link to={`/events/${featured.id}`} className="button button--primary">
              Eu quero!
            </Link>
            <span className="pill">{formatLongDate(featured.startsAt)}</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="em-breve">
        <h2 id="em-breve" className="section-title">
          Próximos <strong>eventos</strong>
        </h2>
        <ul className="event-cards">
          {list.map((event) => (
            <li key={event.id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
        <p className="center">
          <Link to="/events" className="button button--secondary">
            Ver todos os eventos
          </Link>
        </p>
      </section>

      <section className="split" aria-labelledby="camarote">
        <div className="split__media">
          <img src={featured.imageUrl} alt="" loading="lazy" />
          <span className="split__badge">
            <Wifi size={16} aria-hidden /> Dry Conecta
          </span>
        </div>
        <div className="split__text">
          <h2 id="camarote" className="section-title section-title--left">
            Camarote <strong>Dry Telecom</strong>
          </h2>
          <p className="lead">Viva experiências incríveis com a Dry Telecom.</p>
          <p>
            Shows, jogos e grandes eventos com conforto, vista privilegiada e a conexão da Dry para compartilhar cada momento.
            Escolha o evento, reserve e garanta o seu lugar.
          </p>
          <Link to="/events" className="button button--primary">
            Eu quero!
          </Link>
        </div>
      </section>

      <section aria-labelledby="sobre" className="about">
        <h2 id="sobre" className="section-title">
          Operadora convencional é <strong>coisa do passado</strong>
        </h2>
        <p className="lead center">
          Moderna, prática e sem burocracia, a Dry é uma operadora digital criada para conectar você com o futuro da telefonia!
        </p>
        <p className="muted center">Escolha uma paixão e conecte-se com a gente:</p>
        <ul className="chips" aria-label="Operadoras parceiras">
          {PASSIONS.map((name) => (
            <li key={name} className="chip">
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="beneficios">
        <h2 id="beneficios" className="section-title">
          Moderna, prática e <strong>sem burocracia</strong>
        </h2>
        <p className="muted center">Enquanto nossos clientes acumulam GB, nós realizamos sonhos.</p>
        <ul className="benefits">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="benefit">
              <span className="benefit__icon" aria-hidden>
                <Icon size={28} />
              </span>
              <div>
                <h3 className="benefit__title">{title}</h3>
                <p className="muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="section-title">
          Como <strong>funciona</strong>
        </h2>
        <ol className="steps">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="step">
              <span className="step__icon" aria-hidden>
                <Icon size={28} />
              </span>
              <span className="step__number">Passo {index + 1}</span>
              <h3 className="step__title">{title}</h3>
              <p className="muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="split" aria-labelledby="local">
        <div className="split__text">
          <h2 id="local" className="section-title section-title--left">
            <strong>Local</strong> do evento
          </h2>
          <p className="row">
            <MapPin size={18} aria-hidden /> {featured.venue}
          </p>
          <p className="muted">
            Próximo destaque: {featured.name}, em {formatLongDate(featured.startsAt)}.
          </p>
        </div>
        <iframe
          className="map"
          title={`Mapa: ${featured.venue}`}
          src={`https://maps.google.com/maps?q=${encodeURIComponent(featured.venue)}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </section>

      {!user && (
        <section className="cta" aria-labelledby="cta">
          <h2 id="cta" className="section-title">
            Transforme sua paixão em <strong>conexão</strong>
          </h2>
          <p className="muted">Crie sua conta e garanta seus ingressos para os próximos eventos.</p>
          <Link to="/register" className="button button--primary">
            Criar conta
          </Link>
        </section>
      )}
    </>
  );
}
