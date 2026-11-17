# Rules and design

Design doc (2026-10-21) aligned with what the local prototype already implements. Numeric knobs: `game-server/config/game.config.toml`.

## Role in GNUverse

A playful analogy for collaboration, versioning, and governance — **not** a full definition of free software by itself. The team contextualizes the four freedoms in posts. Independent from the blog: a ban on one tower does not remove the account or affect articles.

## Form and loop

Side view, geometric blocks (monochrome SVG in the prototype), simplified rigid-body physics. Loop: enter → pick a tower → build → watch → history/decisions → continue.

## Coins

- One coin every X seconds up to a cap; wallet is **global** across towers.
- Recovery also while offline (server computes elapsed time).
- Per-block cost set by the creator (zero allowed); balance and cost visible before the action.
- Spend does not transfer to the creator; restore does not refund coins.
- Free towers use a minimum interval between actions.
- Server validates balance/interval/cost atomically.

## Per-tower governance

Creator = tower BDFL. Ban and restore are configured **separately** (vote or BDFL). Bans are local to the tower. Voter eligibility: manual or minimum contributions; one vote per eligible person. Freeze the electorate when a proposal opens.

Proposals record tower, reason, target/version, rules, deadline, quorum, votes, and result. BDFL decisions need a public justification (pseudonym, no email).

## History

Stabilized snapshots; restore creates a new event without erasing later history. Accounts, coins, and bans do not time-travel. No Git commits per action.

## Implemented locally

Signup via CMS identity, wallet, tower creation, wind, proposals, BDFL, history, and restore via `make dev`. Production hosting: [Production](production.md).
