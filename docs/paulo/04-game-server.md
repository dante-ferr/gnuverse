# 4. O `game-server/` e a integração em produção

Embora seu foco atual seja fazer o blog, **o build do site no Cloudflare compila o projeto inteiro** (incluindo `/jogo/`). Além disso, no código do repositório o `game-server/` já está pronto localmente — o que falta é hospedá-lo e passar a URL dele para o build do site.

---

## Como o `game-server/` funciona por dentro

Para quem vem de C + Node.js, o código em `game-server/` é bem direto (zero framework mágico):

- **HTTP puro:** criado com `node:http` (`createServer`) em [game-server/server.ts](../../game-server/server.ts) e roteado manualmente em [game-server/transport/http-application.ts](../../game-server/transport/http-application.ts).
- **Entrada:** [game-server/index.ts](../../game-server/index.ts), rodado em TypeScript nativo pelo Node `>= 22.18` via `npm run game:dev` (`node --env-file-if-exists=.env.local game-server/index.ts`), sem passo de compilação prévia.
- **Estado em memória + SQLite transacional:** [game-server/persistence/game-store.ts](../../game-server/persistence/game-store.ts) usa o módulo embutido `node:sqlite` (`DatabaseSync`) com `PRAGMA journal_mode=WAL` e `PRAGMA busy_timeout=5000`. Todo o estado (`users`, `sessions`, `towers`) fica em memória e é persistido como JSON numa única linha (`game_state id=1`) via `store.atomic(...)` (`BEGIN IMMEDIATE ... COMMIT`, com rollback tanto no SQLite quanto no objeto em memória se algo lançar exceção).
- **Lock exclusivo de escrita (single-process):** [game-server/persistence/database-lock.ts](../../game-server/persistence/database-lock.ts) cria um arquivo sidecar `<dbPath>.writer-lock` e segura uma transação `BEGIN EXCLUSIVE` no SQLite para impedir duas instâncias do servidor no mesmo arquivo (o kernel libera o lock automaticamente se o processo morrer, inclusive por `SIGKILL`).
- **Tempo real via SSE:** `GET /api/towers/:id/events` em [game-server/runtime/simulation-coordinator.ts](../../game-server/runtime/simulation-coordinator.ts) mantém a resposta HTTP aberta (`Content-Type: text/event-stream`, `X-Accel-Buffering: no`, limite de 100 espectadores por torre).
- **Física e regras:** usa `matter-js` para simulação 2D no servidor e `smol-toml` para ler [game-server/config/game.config.toml](../../game-server/config/game.config.toml).

---

## O que falta resolver para produção (e o que afeta você no deploy do site)

1. **Escolher onde hospedar o `game-server`:**
   - **Render Free NÃO serve** por dois motivos fatais aqui: ele **suspende** o processo após inatividade (matando conexões SSE e timers de vento/votação) e **apaga o disco local** a cada reinício (apagando o `.sqlite`).
   - Ele exige um provedor com **processo sempre ligado (1 única instância)** e **volume persistente montado em disco** (ex.: VPS com Docker/systemd, Fly.io com Volume, Railway com Volume, etc.).
   - *Por que apenas 1 instância?* Como o estado ativo da simulação fica na RAM e o `database-lock.ts` trava escrita única no SQLite, escalar horizontalmente para 2 réplicas quebraria o jogo.
2. **Atenção crítica a `GAME_HOST=0.0.0.0`:**
   - Em [game-server/index.ts](../../game-server/index.ts) linha 5, o padrão é `process.env.GAME_HOST ?? '127.0.0.1'`.
   - Em container/PaaS ou atrás de proxy reverso em outra rede, escutar só em `127.0.0.1` bloqueia o roteamento externo. Em produção, configure **`GAME_HOST=0.0.0.0`** e **`GAME_PORT`** de acordo com o provedor.
3. **Disco persistente (`GAME_DB_PATH`):**
   - Por padrão aponta para `.content/game.sqlite`. Em produção, aponte `GAME_DB_PATH` para dentro do volume persistente montado (ex.: `/data/game.sqlite`) e **nunca** apague o `.writer-lock` enquanto o servidor estiver rodando.
4. **CORS (`GAME_ALLOWED_ORIGINS`):**
   - `http-application.ts` bloqueia qualquer `Origin` de navegador que não esteja listada exatamente em `GAME_ALLOWED_ORIGINS`.
   - Em produção, defina a URL HTTPS do site no Cloudflare Pages, **sem barra no final** (ex.: `https://gnuverse.pages.dev`, ou múltiplas origens separadas por vírgula se houver domínio customizado).
5. **Conectar o site estático ao `game-server` (`NEXT_PUBLIC_GAME_API_URL`):**
   - [src/components/game/api/game-api.ts](../../src/components/game/api/game-api.ts) lê `process.env.NEXT_PUBLIC_GAME_API_URL || 'http://localhost:3002'` em **tempo de build**.
   - Depois que o `game-server` tiver uma URL HTTPS pública, configure `NEXT_PUBLIC_GAME_API_URL` no Cloudflare Pages e **dispare um novo build do site** (sem isso, `/jogo/` no ar vai tentar chamar `http://localhost:3002`).
6. **Segurança e proxy SSE:**
   - Mantenha `NODE_ENV=production` e `GAME_INFINITE_COINS=false` (em [game-server/runtime/rules.ts](../../game-server/runtime/rules.ts), moedas infinitas já são desativadas quando `NODE_ENV === 'production'`).
   - Use HTTPS na frente do `game-server` (navegadores bloqueiam *mixed content* HTTPS -> HTTP) e confira se o proxy reverso respeita `X-Accel-Buffering: no` e timeouts longos para SSE.
7. **Atualizar a documentação antiga do repo:**
   - Atualizar [arquitetura-cms.md](../arquitetura-cms.md) e [planejamento.md](../planejamento.md), que ainda dizem que o backend do jogo não existe.
