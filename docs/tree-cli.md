# CLI da árvore na caverna

Interface não interativa para agentes e scripts. JSON em stdout; erros em stderr com código de saída diferente de zero.

## Constantes do mundo

Valores vêm de `game-server/config/game.config.toml` (servidor e `GET /api/rules`). Principais chaves:

| Chave TOML | Significado |
| --- | --- |
| `world_width` × `world_height` | Tamanho da caverna |
| `exit_x`, `exit_y`, `exit_width`, `exit_height` | Retângulo da saída no topo |
| `root_x`, `root_clearance_above_terrain` | Raiz ancorada no terreno procedural |
| `terrain_amplitude`, `terrain_max_slope` | Terreno (máx. ~48 u acima do vale; inclinação máx. Δy/Δx) |
| `l_max` | Comprimento máximo do galho |
| `min_ground_clearance` | Folga mínima em relação ao terreno |
| `min_upward_delta` | Crescimento para cima (Δy ≥ valor; y menor = mais alto) |
| `energy_capacity` / `energy_initial` | Energia |
| `action_window_ms` / `physics_phase_ms` | Janela de ação / fase de física |
| `balance_cap` / `initial_balance` / `coin_interval_ms` | Moedas |

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
node game-server/cli/tree-cli.ts grow --id <uuid> --segment <nodeId> --anchor-x 400 --anchor-y 1090 --x 420 --y 1020 --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts leaf --id <uuid> --node <nodeId> --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts fortify --id <uuid> --node <nodeId> --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts prune --id <uuid> --node <nodeId> --token "$GAME_CLI_TOKEN"
node game-server/cli/tree-cli.ts wait --id <uuid> --timeout 15000 --token "$GAME_CLI_TOKEN"
```

`grow` envia JSON:

```json
{
  "segmentId": "<id do segmento (nó filho do galho, ou raiz)>",
  "anchorX": 400,
  "anchorY": 1090,
  "x": 420,
  "y": 1020
}
```

`--parent` ainda é aceito como alias de `--segment`. Se `--anchor-x` / `--anchor-y` forem omitidos, a âncora é o nó do segmento (compatível com scripts antigos).

Use credenciais de teste descritas em [`jogo-local.md`](jogo-local.md). O login chama a mesma API `POST /api/login` do jogo.