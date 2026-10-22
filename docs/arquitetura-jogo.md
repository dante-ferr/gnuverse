# Arquitetura do jogo

O jogo é uma aplicação de navegador ligada a um backend Node independente do CMS. A página é montada em `/jogo/`; a interface fala com uma API HTTP e recebe atualizações da torre por eventos enviados pelo servidor (SSE). As regras são validadas e persistidas no backend, enquanto React apresenta a construção e as decisões.

## Frontend

```text
src/app/jogo/page.tsx                 entrada da rota
src/components/game/
├── tower-game.tsx                    composição da experiência
├── tower-game.module.css             estilos compartilhados
├── api/game-api.ts                   HTTP e abertura do fluxo SSE
├── hooks/
│   ├── use-game-controller.ts        ações e coordenação da experiência
│   ├── use-game-session.ts           sessão, conta e carteira
│   ├── use-tower-lobby.ts            lista e seleção de torres
│   ├── use-tower-stream.ts           estado em tempo real da torre
│   └── use-action-feedback.ts        estado de envio, avisos e erros
├── model/
│   ├── types.ts                      contratos do cliente
│   ├── block-catalog.ts              formas e cores de blocos
│   └── presentation.ts               formatação para a interface
├── construction/
│   ├── tower-scene.tsx               cenário SVG, posição e preview
│   ├── block-shapes.tsx              desenho dos blocos
│   ├── block-controls.tsx            controles de lançamento
│   ├── create-tower-panel.tsx        formulário de criação
│   └── tower-toolbar.tsx             seleção de torres e conexão
├── account/
│   ├── auth-panel.tsx                cadastro e login
│   └── account-banner.tsx            conta e carteira
└── community/
    ├── history-panel.tsx             versões e restauração
    ├── members-panel.tsx              participantes e habilitação
    ├── proposals-panel.tsx            propostas e votos
    ├── tower-community.tsx            composição da comunidade
    ├── proposal-form.tsx             abertura de propostas
    ├── tower-settings.tsx             regras da torre
    └── event-detail.tsx               detalhes do histórico
```

`TowerGame` reúne os módulos. A camada `api` cuida do transporte; hooks mantêm estado e ações da experiência; componentes em `construction`, `account` e `community` recebem valores e callbacks. `model` guarda tipos e catálogos sem chamar a rede.

## Backend

```text
game-server/
├── index.ts                         configuração de processo e início do servidor
├── server.ts                        composição das dependências
├── config/
│   ├── load-game-config.ts           leitura e validação do TOML
│   └── game.config.toml              regras ajustáveis do protótipo
├── domain/
│   ├── types.ts                     contratos do domínio
│   └── validation.ts                validação de entradas
├── transport/
│   ├── http-application.ts          rotas, respostas e CORS
│   └── http-helpers.ts              leitura e respostas HTTP
├── auth/auth-service.ts             cadastro, login e sessões
├── economy/wallet-service.ts        saldo, recuperação e custo
├── governance/governance-service.ts propostas, votos e suspensões
├── towers/
│   ├── tower-service.ts             criação e ações das torres
│   └── history-service.ts           eventos, snapshots e restauração
├── runtime/
│   ├── rules.ts                     regras efetivas do jogo
│   └── simulation-coordinator.ts    simulação e atualizações SSE
├── persistence/
│   ├── game-store.ts                estado transacional SQLite
│   └── database-lock.ts             exclusão mútua da instância
└── physics/
    ├── index.ts                     API pública da física
    ├── tower-simulation.ts          simulação da torre
    ├── block-body.ts                corpo rígido de bloco
    ├── catalog.ts                   propriedades físicas das formas
    └── types.ts                     tipos da simulação
```

`index.ts` inicia o processo. `server.ts` conecta transporte, serviços, persistência e física. O transporte converte requisições HTTP em chamadas aos serviços; serviços aplicam regras do domínio e o `GameStore` grava o estado no SQLite. `SimulationCoordinator` avança a física e publica atualizações, enquanto `physics/index.ts` define a interface do motor.

## Regras configuráveis

[`game.config.toml`](../game-server/config/game.config.toml) guarda os parâmetros ajustáveis do protótipo. `config/load-game-config.ts` lê esse arquivo na inicialização, rejeita chaves ou valores inválidos e fornece as regras validadas ao servidor. A interface pode exibir essas regras, mas o backend valida saldo, custo, intervalos e decisões antes de gravar ações.

## Limites da implantação

O site continua exportado como conteúdo estático; o backend precisa ser hospedado separadamente para uso fora da rede local. O serviço atual usa uma instância Node e SQLite, e não compartilha estado entre instâncias. A hospedagem de produção, durabilidade, monitoramento e operação de múltiplas instâncias ainda precisam ser definidos. Veja o [guia local](jogo-local.md) para iniciar frontend e backend e conhecer os limites atuais.
