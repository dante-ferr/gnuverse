# Element recipes

Open Pipeline packets are **elements** defined in TOML under `game-server/config/`. Nested geometric shapes are retired; see [Locked decisions](../decisions.md) §10.

## Authoring

- Primary book: `game-server/config/elements.toml`
- Optional extras: any `*.toml` under `game-server/config/elements/`
- Each composite lists exactly two distinct `inputs`
- `tier(output) = 1 + max(tier(inputs))`; highest tier is 4

## Local preview

```bash
make elements-serve
```

Open [http://127.0.0.1:3010](http://127.0.0.1:3010). The page rebuilds from TOML on every refresh. Each recipe is its own collapsible SVG chart (no Mermaid).

Optional static snapshot: `npm run elements:build` → `game-server/config/elements-graph.html` (gitignored).

Portuguese labels (`name_pt`) are for the in-game UI later; this preview page is a design tool.
