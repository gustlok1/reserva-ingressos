import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { server } from './setup';
import { loggedIn, makeEvent, makeReservation, renderApp } from './render';

describe('cenário 6: 409 ao reservar', () => {
  it('mostra mensagem compreensível, encerra o carregamento e atualiza a disponibilidade', async () => {
    let eventRequests = 0;
    server.use(
      loggedIn,
      // 1ª leitura: 2 disponíveis. Depois do conflito, outra pessoa já reservou: 0 disponíveis.
      http.get('*/api/events/3', () => HttpResponse.json({ data: makeEvent({ available: eventRequests++ === 0 ? 2 : 0 }) })),
      http.post('*/api/reservations', async () => {
        await delay(50); // tempo para observar o estado de carregamento
        return HttpResponse.json(
          { error: { code: 'INSUFFICIENT_AVAILABILITY', message: 'Ingressos insuficientes. Disponíveis: 0.' } },
          { status: 409 },
        );
      }),
    );
    const user = userEvent.setup();
    renderApp('/events/3');

    expect(await screen.findByText('2 disponíveis')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /reservar/i });

    await user.click(submit);
    expect(submit).toBeDisabled(); // durante o envio: sem clique duplo
    expect(submit).toHaveAttribute('aria-busy', 'true');

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingressos insuficientes. Disponíveis: 0.');
    expect(await screen.findByText('Esgotado')).toBeInTheDocument(); // disponibilidade recarregada, sem F5
    expect(submit).toHaveAttribute('aria-busy', 'false'); // carregamento encerrado
    expect(submit).toBeDisabled(); // continua desabilitado, agora porque esgotou
    expect(eventRequests).toBe(2);
  });
});

describe('fluxos da interface', () => {
  it('sem sessão, uma tela protegida leva para o login', async () => {
    server.use(http.get('*/api/auth/me', () => HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 })));
    renderApp('/reservations');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  it('login inválido mostra a mensagem da API', async () => {
    server.use(
      http.get('*/api/auth/me', () => HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 })),
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'E-mail ou senha inválidos.' } }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(await screen.findByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
  });

  it('quando o countdown termina, consulta a API e mostra a reserva expirada', async () => {
    let reservationRequests = 0;
    server.use(
      loggedIn,
      http.get('*/api/reservations/10', () => {
        reservationRequests++;
        // serverTime = expiresAt: pelo relógio do servidor o prazo acabou de terminar.
        const reservation = makeReservation({ status: reservationRequests === 1 ? 'PENDING' : 'EXPIRED' });
        return HttpResponse.json({ data: reservation, serverTime: reservation.expiresAt });
      }),
    );
    renderApp('/reservations/10');

    expect(await screen.findByText(/o prazo para confirmar terminou/i)).toBeInTheDocument();
    expect(screen.getByText('Expirada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /finalizar compra/i })).not.toBeInTheDocument();
    await waitFor(() => expect(reservationRequests).toBe(2));
  });

  it('confirmar uma reserva pendente mostra o sucesso', async () => {
    server.use(
      loggedIn,
      http.get('*/api/reservations/10', () =>
        HttpResponse.json({ data: makeReservation(), serverTime: '2026-10-16T12:01:00.000Z' }),
      ),
      http.post('*/api/reservations/10/confirm', () =>
        HttpResponse.json({ data: makeReservation({ status: 'CONFIRMED' }), serverTime: '2026-10-16T12:01:05.000Z' }),
      ),
      http.get('*/api/reservations', () => HttpResponse.json({ data: [], serverTime: '2026-10-16T12:01:05.000Z' })),
    );
    const user = userEvent.setup();
    renderApp('/reservations/10');

    expect(await screen.findByText('04:00')).toBeInTheDocument(); // 12:05 - 12:01 pelo relógio do servidor
    await user.click(screen.getByRole('button', { name: /finalizar compra/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Compra confirmada!');
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
  });
});

describe('extras pós-entrega', () => {
  const anonymous = http.get('*/api/auth/me', () => HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 }));

  it('a home é pública e marca o evento esgotado', async () => {
    server.use(
      anonymous,
      http.get('*/api/events', () =>
        HttpResponse.json({
          data: [makeEvent({ id: 1, name: 'Rock na Arena', available: 10 }), makeEvent({ id: 3, available: 0 })],
          pagination: { page: 1, pageSize: 6, total: 2, totalPages: 1 },
        }),
      ),
    );
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Rock na Arena' })).toBeInTheDocument(); // destaque
    expect(screen.getByRole('article', { name: /Camarote VIP - Noite Eletrônica, Esgotado/ })).toHaveClass('event-card--soldout');
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
  });

  it('cadastro mostra o erro da API embaixo do campo', async () => {
    server.use(
      anonymous,
      http.post('*/api/auth/register', () =>
        HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: [{ field: 'password', message: 'A senha precisa ter pelo menos 8 caracteres.' }] } },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(await screen.findByLabelText('Nome completo'), 'Carla Dias');
    await user.type(screen.getByLabelText('E-mail'), 'carla@exemplo.com');
    await user.type(screen.getByLabelText(/^Senha/), '123');
    await user.type(screen.getByLabelText('Confirmar senha'), '123');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('A senha precisa ter pelo menos 8 caracteres.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Senha/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('usuário comum não vê a área de admin', async () => {
    server.use(loggedIn);
    renderApp('/admin/events');

    expect(await screen.findByText('Esta área é só para administradores.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin: eventos/i })).not.toBeInTheDocument();
  });
});
