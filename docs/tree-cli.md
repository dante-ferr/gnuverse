# CLI da árvore na caverna

Interface não interativa para agentes e scripts. JSON em stdout; erros em stderr com código de saída diferente de zero.

## Constantes do mundo

| Constante | Valor |
| --- | --- |
| Largura × altura | 800 × 1200 |
| Saída (topo, centro) | retângulo 160 × 80 em x=320, y=0 |
| Raiz fixa | x=400, y=1100 |
| `L_max` | 90 |
| Folga mínima do chão | 40 |
| Crescimento para cima | Δy ≥ 20 (eixo y para cima visual: y menor no canvas) |
| Energia (capacidade / inicial) | 100 / 40 |
| Janela de ação | 10 s |
| Fase de física | 4 s |
| Moedas | +1 a cada 6 s, teto 5, saldo inicial 5 |

Coordenadas seguem o Matter.js (y cresce para baixo).

## Pré-requisitos

```sh
npm run game:dev
```

Base da API: `http://127.0.0.1:3002` ou `GAME_API_URL`.

## Comandos

```sh
node game-server/cli/tree-cli.ts login --email SEU@EMAIL --password 'sua-senha'
export GAME_CLI_TOKEN=...   # token retornado

node game-server/cli/tree-cli.ts list --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts create --name minha-caverna --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts status --id <uuid> --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts grow --id <uuid> --parent <nodeId> --x 420 --y 1020 --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts leaf --id <uuid> --node <nodeId> --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts fortify --id <uuid> --node <nodeId> --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts prune --id <uuid> --node <nodeId> --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts root --id <uuid> --parent <nodeId> --x 400 --y 1140 --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts wait --id <uuid> --timeout 15000 --token "$GAME_CLI_TOKEN"
```

Use credenciais de teste descritas em [`jogo-local.md`](jogo-local.md). O login chama a mesma API `POST /api/login` do jogo.