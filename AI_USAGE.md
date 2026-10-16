# Uso de IA

> Rascunho preparado a partir do histórico da conversa. **Revise e ajuste com as suas palavras antes de entregar**, principalmente o tempo efetivo e os trechos marcados com ✏️.

## Ferramentas e modelos

| Ferramenta | Modelo | Onde ajudou |
|---|---|---|
| Claude Code (Anthropic), sessão na nuvem integrada ao GitHub | Claude Opus 5.5 | Leitura do enunciado, planejamento em fases, implementação do backend e do frontend, testes, revisão, diagnóstico de problemas de ambiente e documentação |
| Claude Design (Anthropic) | ✏️ (informar se souber) | Geração do design system "Dry Telecom" a partir de capturas de tela de referência: tokens de cor, tipografia, espaçamento, sombras e componentes base |

**Como trabalhei:** cada fase foi feita numa branch própria e revisada por mim num Pull Request antes do merge (`fase-2-banco` até `fase-7-frontend`). Pedi explicações do código com paralelos ao C#, linguagem com a qual tenho mais experiência, para conseguir explicar e alterar cada parte. Os commits gerados pela IA aparecem com o autor "Claude"; os ajustes e merges, com o meu nome.

**Tempo efetivo aproximado:** ✏️ cerca de **X horas**. A sessão começou por volta das 8h50 e as funcionalidades e a documentação ficaram prontas por volta das 12h20 (horário de Brasília), incluindo cerca de 40 minutos perdidos com problemas de ambiente no computador (Docker, compilação nativa e Git).

---

## Exemplo 1: Docker sugerido como se fosse requisito

- **Objetivo:** definir como rodar o PostgreSQL localmente, depois que eu pedi para trocar o SQLite pelo PostgreSQL.
- **Trecho do prompt:** *"antes de seguirmos, quando o docker foi escolhido e porque? era exigido?"*
- **Sugestão da IA:** a IA tinha incluído um `docker-compose.yml` no plano e passou a tratá-lo como decisão tomada. Quando perguntei, admitiu que **não era exigido** e que deveria ter apresentado como opção.
- **O que decidi:** manter o Docker como opcional. Logo depois, o Docker Desktop não abriu no computador corporativo (falha na verificação de grupo do domínio da empresa), e a IA também apontou que ele pode exigir licença paga em empresas grandes. Reavaliamos e voltamos para o **SQLite**, que o enunciado aceita, elimina o servidor de banco e simplifica a execução num ambiente limpo.
- **Como validei:** consultei o enunciado ("Não são exigidos deploy, CI/CD, Docker...") e testei a execução na minha máquina.
- **Lição:** a IA pode apresentar uma preferência como requisito. Conferir no documento original evitou uma dependência desnecessária.

## Exemplo 2: dependência nativa que não instalava (persistência)

- **Objetivo:** configurar o acesso ao SQLite.
- **Trecho do prompt:** colei o erro do `npm rebuild better-sqlite3` (*"gyp ERR! find Python ... You need to install the latest version of Python"*).
- **Sugestão da IA:** explicou que o `better-sqlite3` não tinha binário pronto para o Node 26 e tentava compilar, o que exige Python e Visual Studio Build Tools. Antes de propor a alternativa, **inspecionou o pacote publicado do Drizzle ORM** e verificou que a versão estável (0.45.4) não suportava o módulo nativo `node:sqlite`. Propôs então usar o `node:sqlite` com SQL escrito à mão e um runner de migrations próprio.
- **O que decidi:** aceitei. Além de eliminar a dependência nativa, o SQL explícito deixa visível no código a transação que protege a concorrência, o que é mais fácil de explicar do que "o ORM cuida disso".
- **Como validei:** execução manual (`node -e "require('node:sqlite')..."` imprimiu a versão do SQLite), testes de migrations e seed idempotentes e `npm run db:setup` rodando duas vezes sem duplicar registros.

## Exemplo 3: um teste de concorrência que passava sem proteção (concorrência)

- **Objetivo:** provar a regra mais crítica do teste, de que duas reservas simultâneas dos últimos ingressos resultam em um sucesso e um conflito, também com mais de uma instância do backend.
- **Trecho do prompt:** ✏️ *"faça a fase 5"* (a fase incluía o cenário 2 do enunciado).
- **Sugestão da IA:** implementar a criação da reserva dentro de `BEGIN IMMEDIATE` (lock de escrita no arquivo do banco). Para testar, a IA escreveu dois testes: um com duas instâncias do app **no mesmo processo** e outro que sobe **dois servidores reais em processos separados**, apontando para o mesmo arquivo, disparando as requisições ao mesmo tempo (2 + 2 ingressos com capacidade 2, e 40 reservas de 1 ingresso com capacidade 5). A suspeita era que o primeiro **não provava nada**: o Node executa uma requisição síncrona de cada vez, então ele passaria mesmo sem a proteção.
- **O que decidi:** manter os dois testes, mas documentar que só o de processos separados vale como prova.
- **Como validei:** **contraprova**. Removemos a transação de propósito e rodamos os testes. O teste em processo único continuou passando (confirmando a suspeita), e os testes entre processos falharam com venda excedente (`[201, 201]` no evento de capacidade 2, e 6 ingressos vendidos para 5 vagas). Com a transação de volta, os testes passaram. A mesma técnica foi usada no cenário 6 do frontend.

---

## Outras revisões relevantes

- **Regra de negócio e segurança:** testes garantem que preço, total, status, validade e `userId` enviados no corpo são ignorados (o preço vem do banco e o usuário vem da sessão), e que a reserva de outro usuário responde 404, igual a uma inexistente. Validei também manualmente pela API com PowerShell.
- **Erro da própria IA:** na fase 1, a IA notou que o backend tinha ficado com o TypeScript 7 e o frontend com o 6, e disse que não era preciso fazer nada. Na fase do frontend, descobriu que o TS 7 na raiz do `node_modules` quebrava o `typescript-eslint` do frontend (o lint estava quebrado desde o início). A correção foi fixar uma versão única com `overrides`. Validei rodando o `eslint` e os testes depois da reinstalação.
- **Sugestões que corrigi ou rejeitei:** ✏️ (ex.: o conflito de merge na fase 2, resolvido por mim; outros ajustes que você tenha feito durante os testes manuais).
