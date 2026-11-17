# Arquitetura do jogo

A partida jogável é o **Open Pipeline**. O navegador fala com um backend Node por HTTP e SSE. O estado autoritativo da grade fica em `game-server/pipeline/`; a sala é desenhada no canvas em `src/components/game/pipeline/`. As rotas públicas permanecem `/jogo/`, `/jogo/torre/?id=<uuid>` e a API em `/api/towers` (nomes legados, mantidos por decisão).

Cada sala (`Room`) guarda o estado da partida em `Room.frame` (`PipelineFrame`). Histórico usa `Snapshot.frame`. No SQLite, o documento é `State.rooms`; leituras antigas ainda aceitam a chave `towers` no JSON salvo.

## Frontend

```text
src/app/jogo/page.tsx                 → PipelineLobby
src/app/jogo/torre/page.tsx           → PipelineRoom
src/components/game/
├── pipeline-lobby.tsx                lobby Open Pipeline (lista de salas)
├── game-shell.module.css             estilos compartilhados do shell
├── api/
│   ├── game-api.ts                   HTTP e abertura do fluxo SSE
│   ├── list-rooms.ts                 listagem e filtros locais de salas
│   └── create-room.ts                criação de sala
├── hooks/
│   ├── use-game-session.ts           sessão, conta e carteira
│   ├── use-room-lobby.ts             lista e seleção de salas
│   └── use-action-feedback.ts        estado de envio, avisos e erros
├── model/
│   ├── types.ts                      contratos do cliente
│   └── presentation.ts               formatação para a interface
├── construction/
│   ├── create-room-panel.tsx         formulário de criação de sala
│   ├── room-toolbar.tsx              seleção de salas e conexão
│   └── room-cover.tsx                capa da sala no lobby
├── account/
│   ├── auth-panel.tsx                cadastro e login (páginas dedicadas)
│   └── account-banner.tsx            conta e carteira
└── pipeline/
    ├── pipeline-room.tsx             barra superior + canvas em tela cheia
    ├── hooks/use-pipeline-stream.ts  estado em tempo real via SSE
    ├── model/frame.ts                tipos do frame no cliente
    └── scene/                          PipelineScene, câmera, esteiras, painters
```

`PipelineLobby` e `PipelineRoom` compõem a experiência. A camada `api` cuida do transporte; os hooks mantêm sessão, lobby e feedback; `construction` e `account` recebem props e callbacks; `pipeline/scene` desenha a grade no canvas (sem Matter.js nem cena em árvore).

## Backend

```text
game-server/
├── index.ts                          configuração de processo e início do servidor
├── server.ts                         composição das dependências
├── config/
│   ├── load-game-config.ts           leitura e validação do TOML
│   └── game.config.toml              regras ajustáveis (inclui `[pipeline]`)
├── domain/
│   ├── types.ts                      Room, Snapshot, State, contratos
│   └── validation.ts                 validação de entradas
├── transport/
│   ├── http-application.ts           rotas, respostas e CORS
│   └── http-helpers.ts               leitura e respostas HTTP
├── auth/auth-service.ts              cadastro, login e sessões
├── economy/wallet-service.ts         saldo, recuperação e custo
├── governance/governance-service.ts  propostas, votos e suspensões
├── rooms/
│   ├── room-service.ts               criação e ações das salas
│   └── history-service.ts            eventos, snapshots e restauração
├── runtime/
│   ├── rules.ts                      regras efetivas do jogo
│   └── simulation-coordinator.ts     tick da grade e atualizações SSE
├── persistence/
│   ├── game-store.ts                 estado transacional SQLite
│   └── database-lock.ts              exclusão mútua da instância
└── pipeline/
    ├── geometry/                     direção, chaves de célula
    ├── machines/                     fonte, núcleo 5×5, esteiras
    ├── packets/                      pacotes (círculo em v0.1)
    ├── world/                        Match, frame, movimento, emissão, BeltEditor
    ├── rules.ts                      espelho TypeScript do TOML
    └── load-rules.ts                 validação de `[pipeline]`
```

`index.ts` inicia o processo. `server.ts` conecta transporte, serviços, persistência e o simulador de pipeline. O transporte converte requisições HTTP em chamadas aos serviços; `room-service` e `pipeline/` aplicam regras e atualizam `Room.frame`; o `GameStore` grava `State.rooms` no SQLite. `SimulationCoordinator` avança o tick da grade e publica frames por SSE — sem motor de física em árvore.

## Regras configuráveis

[`game.config.toml`](../game-server/config/game.config.toml) guarda os parâmetros ajustáveis do protótipo, inclusive a tabela `[pipeline]`. `config/load-game-config.ts` e `pipeline/load-rules.ts` leem e validam na inicialização; valores inválidos impedem a subida do servidor. A interface pode exibir essas regras, mas o backend valida saldo, custo, intervalos e ações antes de gravar.

## Limites da implantação

O site continua exportado como conteúdo estático; o backend precisa ser hospedado separadamente para uso fora da rede local. O serviço atual usa uma instância Node e SQLite, e não compartilha estado entre instâncias. A hospedagem de produção, durabilidade, monitoramento e operação de múltiplas instâncias ainda precisam ser definidos. Veja o [guia local no method book](src/game/local.md) para iniciar frontend e backend e conhecer os limites atuais.