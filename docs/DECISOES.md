# Planejamento, stack e decisões

Documento vivo: registra o que foi planejado, o que foi escolhido e por quê. As decisões que mudaram no caminho estão no histórico, no final.

## Objetivo

Sistema de reserva de ingressos com prazo: o usuário faz login, escolhe um evento, reserva de 1 a 4 ingressos e tem 5 minutos para confirmar uma compra simulada.

Estados da reserva:

| Estado | Quando |
|---|---|
| `PENDING` | Recém-criada, válida até `expires_at` |
| `CONFIRMED` | Confirmada dentro do prazo. Confirmar de novo devolve a mesma reserva |
| `CANCELLED` | Cancelada enquanto estava pendente e válida |
| `EXPIRED` | Pendente com `agora >= expires_at`. Não ocupa capacidade |

"Esgotado" não é um estado: é a resposta `409` quando não há ingressos suficientes, e a reserva nem é criada.

**Invariante central:** `disponíveis = capacidade - confirmados - pendentes válidos`, nunca negativo, mesmo com requisições simultâneas.

## Princípios

1. **Simplicidade:** só o que o requisito pede. Extras não somam pontos.
2. **O backend é a autoridade:** identidade, preço, total, status e tempo são decididos no servidor. O frontend só exibe.
3. **Consistência no banco:** a proteção contra venda excedente fica no banco, não em memória nem no botão.
4. **Código explicável:** cada trecho precisa poder ser explicado na conversa técnica.

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime | Node.js >= 22.13 | Exigido pelo teste. Traz o `node:sqlite` embutido |
| Linguagem | TypeScript (back e front) | Exigido pelo teste |
| Banco | SQLite via `node:sqlite` | Permitido pelo teste, sem servidor para instalar e sem dependência nativa. Ver histórico |
| Acesso a dados | SQL puro em repositórios | Sem ORM: as transações e os locks ficam explícitos no código |
| Migrations | Arquivos `.sql` numerados + runner próprio (`schema_migrations`) | Simples e transparente. Cada migration roda em uma transação |
| API | Express 5 | O mais conhecido. A v5 já trata erros de handlers assíncronos |
| Validação | Zod | Recusa entrada inválida (quantidade 0, fracionária, > 4) com 400 e mensagens claras |
| Senhas | bcryptjs | Hash adequado para senha. Implementação em JS puro, sem compilação |
| Sessão | Token opaco em cookie httpOnly, hash SHA-256 guardado no banco | Logout invalida na hora. Ver "Autenticação" |
| Testes | Vitest + Supertest | Rodam contra o banco real, sem mock da proteção de concorrência |
| Frontend | React + Vite, React Router, TanStack Query | Query facilita "ao receber 409, atualizar os dados sem recarregar" |
| Visual | Design system próprio (exportado do Claude Design) | Tokens CSS + componentes adaptados para o projeto |

## Arquitetura do backend

```
backend/src/
  config.ts          leitura do .env
  app.ts             createApp(deps): monta o Express (sem listen, para os testes)
  server.ts          abre o banco e sobe o servidor
  lib/               clock (relógio injetável), errors (AppError)
  http/              middlewares: tratamento de erros, autenticação
  db/                conexão, transação, migrations, seed
  modules/<área>/
    *.routes.ts      HTTP: lê a requisição, valida e responde
    *.service.ts     regra de negócio
    *.repository.ts  SQL
```

As dependências (banco, relógio, TTLs) são passadas para `createApp`. Assim os testes usam um banco isolado e um relógio controlado.

## Decisões principais

### Concorrência

A criação de reserva roda em `BEGIN IMMEDIATE`. O SQLite pega o **lock de escrita do arquivo** já no início da transação, então outra conexão, mesmo de outro processo do backend, espera (`busy_timeout`) até o `COMMIT`. Dentro da transação: conta os disponíveis, insere a reserva ou responde 409. Confirmar e cancelar usam o mesmo mecanismo.

**Como foi provado:** `tests/concurrency.test.ts` sobe **dois servidores reais, em processos separados**, apontando para o mesmo arquivo. Eles disparam ao mesmo tempo uma reserva de 2 ingressos cada no evento de capacidade 2 (resultado: um 201 e um 409) e 40 reservas de 1 ingresso num evento de capacidade 5 (resultado: exatamente 5 sucessos). Como contraprova, a transação foi removida temporariamente: os dois testes falharam com venda excedente (`[201, 201]`, e 6 ingressos vendidos para 5 vagas). Um teste num único processo não serve como prova, porque o Node executa uma requisição síncrona de cada vez e o teste passaria mesmo sem proteção.

**Limite conhecido:** vale para instâncias que compartilham o mesmo arquivo, ou seja, a mesma máquina. Com várias máquinas, o caminho seria PostgreSQL com `SELECT ... FOR UPDATE` na linha do evento.

### Expiração

Não existe cron. Uma reserva `PENDING` com `agora >= expires_at`:
- **nas leituras** (detalhe e "Minhas reservas"), já aparece com status `EXPIRED`, calculado na resposta;
- **na disponibilidade**, deixa de ser contada, porque o SQL só soma pendentes com `expires_at > agora`;
- **ao tentar confirmar ou cancelar**, é gravada como `EXPIRED` dentro da transação protegida, e a API responde 409 `RESERVATION_EXPIRED`. O erro é devolvido só depois do `COMMIT`, para a gravação não ser desfeita.

Tudo depende de datas gravadas no banco, então funciona igual depois de reiniciar o servidor.

### Transições de estado

| Operação | De | Resultado |
|---|---|---|
| Confirmar | `PENDING` válida | `CONFIRMED` (200) |
| Confirmar | `CONFIRMED` | A mesma reserva, sem alteração (200, idempotente) |
| Confirmar / cancelar | `PENDING` vencida ou `EXPIRED` | 409 `RESERVATION_EXPIRED` |
| Confirmar | `CANCELLED` | 409 `INVALID_RESERVATION_STATE` |
| Cancelar | `PENDING` válida | `CANCELLED` (200), libera os ingressos |
| Cancelar | `CANCELLED` ou `CONFIRMED` | 409 `INVALID_RESERVATION_STATE` |

Os `UPDATE` sempre têm `AND status = 'PENDING'`: um estado final nunca é sobrescrito, mesmo que a regra acima tenha um bug.

### API de reservas

| Método e rota | Função |
|---|---|
| `POST /api/reservations` `{ eventId, quantity }` | Cria reserva `PENDING` (201) |
| `GET /api/reservations` | Lista as reservas do usuário logado |
| `GET /api/reservations/:id` | Detalhe (404 se não for do usuário) |
| `POST /api/reservations/:id/confirm` | Confirma |
| `POST /api/reservations/:id/cancel` | Cancela |

Toda resposta traz `serverTime`, que é a referência de horário para o countdown. Campos extras no corpo (`userId`, `unitPriceCents`, `status`...) são descartados pelo Zod.

### Tempo

- Datas em ISO-8601 UTC (`toISOString()`), comparáveis como texto.
- O relógio é injetável (`clock.now()`): os testes avançam o tempo sem esperar 5 minutos.
- `RESERVATION_TTL_SECONDS` permite encurtar o prazo em demonstrações.
- O countdown do frontend usa `expiresAt` e o horário do servidor, não o relógio do navegador.

### Catálogo de eventos

- `GET /api/events?search=&page=1&pageSize=10`: paginação no servidor (`LIMIT/OFFSET`), ordenada por `starts_at, id`. O `id` desempata eventos no mesmo horário, então a ordem é estável entre páginas.
- A disponibilidade é calculada por SQL em cada leitura, numa única definição (`OCCUPIED_SQL`) que a criação de reserva também usa. Assim a tela e a regra de negócio nunca divergem.
- Eventos que já começaram continuam listados, com `hasStarted: true`. A API recusa reservas para eles.

### Dinheiro

Valores inteiros em centavos (`price_cents`, `total_cents`). A reserva congela o `unit_price_cents` no momento em que é criada.

### Autenticação

- Login por e-mail e senha. Erro genérico ("e-mail ou senha inválidos") para não revelar quais e-mails existem.
- A sessão é um token aleatório de 32 bytes no cookie `session` (`httpOnly`, `SameSite=Lax`). O banco guarda só o **hash** do token.
- Expira em `SESSION_TTL_HOURS` (padrão 8h), sem renovação automática. O logout apaga a sessão no banco.
- **Por que não JWT:** invalidar um JWT no logout exige blacklist ou refresh token. Com a sessão no banco, basta apagar a linha.

### Autorização

Reserva de outro usuário responde **404**, igual a uma reserva que não existe, para não revelar que ela existe.

### Erros

Formato único: `{ "error": { "code": "...", "message": "...", "details"?: [...] } }`. Status: 400 entrada inválida, 401 sem autenticação, 404 não encontrado, 409 conflito (sem saldo, evento já iniciado, estado incompatível). Nunca expõe stack trace.

## Plano em fases

| Fase | Conteúdo | Status |
|---|---|---|
| 1 | Monorepo (npm workspaces), backend Express, frontend Vite | Concluída |
| 2 | Banco: conexão, migrations, seed idempotente | Concluída |
| 3 | Autenticação: login, logout, `/me`, middleware, erros padronizados | Concluída |
| 4 | Eventos: listagem com busca e paginação, detalhe com disponibilidade | Concluída |
| 5 | Reservas: criar (protegida), confirmar idempotente, cancelar, listar | Em andamento |
| 6 | Testes obrigatórios do backend (cenários 1 a 5) | Adiantada na fase 5 |
| 7 | Frontend: telas, countdown, tratamento de erros | |
| 8 | Teste de interface (cenário 6), README e AI_USAGE.md | |

Cada fase vai numa branch própria e é revisada antes do merge.

## Histórico de decisões que mudaram

1. **SQLite → PostgreSQL.** A primeira proposta foi SQLite, pela simplicidade. A troca para PostgreSQL veio pela robustez em concorrência.
2. **Docker para o PostgreSQL → descartado.** O Docker não era exigido pelo teste (foi uma sugestão da IA, apresentada como se fosse decisão). No PC corporativo, o Docker Desktop não abriu: falhou a verificação de grupo do domínio da empresa, e ele ainda pode exigir licença paga em empresas grandes.
3. **PostgreSQL → SQLite.** O teste aceita os dois. O SQLite elimina riscos de ambiente (instalador, permissões, porta) e garante a consistência com `BEGIN IMMEDIATE`. Também facilita para o avaliador rodar o projeto do zero.
4. **better-sqlite3 + Drizzle → `node:sqlite` + SQL puro.** O `better-sqlite3` não tinha binário para o Node 26 e tentou compilar, o que exige Python e Build Tools. O Drizzle 0.45 (estável) não suporta o `node:sqlite` (verificado no pacote publicado). Resultado: zero dependência nativa e SQL explícito.

## Limitações conhecidas

- O `node:sqlite` ainda emite `ExperimentalWarning` no Node 22–26. É inofensivo.
- O SQLite garante consistência entre processos da mesma máquina, não entre máquinas diferentes.
- A busca usa `LIKE`, que no SQLite ignora maiúsculas/minúsculas só em letras sem acento: "rock" encontra "Rock", mas "ELETRÔNICA" não encontra "Eletrônica". Para resolver, seria preciso uma coluna normalizada (sem acento, minúscula).
- O seed cria eventos com datas relativas ao dia em que roda. Se as datas já tiverem passado, use `npm run db:reset`.
