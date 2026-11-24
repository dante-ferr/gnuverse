# Checkpoints and room decisions

Players can roll the factory back to an earlier point. Restoring is a group
decision: it is proposed, contributors agree, and either the room owner (BDFL) or
a contributor majority accepts it.

## When checkpoints are saved

| Checkpoint | Saved when |
| --- | --- |
| `created` | The room is created. Always kept. |
| `spend` | Coins spent in the room since the last checkpoint reach `checkpoint_spend_coins`. The counter (`room.checkpointSpend`) then resets to zero. |
| `pre-restore` | Just before a restore, so a bad restore can itself be undone by another proposal. |

Spend counts the coins charged for belts, machines, and chunk and core pledges.
Refunds do not reduce it. Sandbox rooms charge nothing, so they never save spend
checkpoints.

A room keeps the `created` checkpoint, any checkpoint that a pending restore
proposal points at, and the newest `checkpoint_limit` others. Both numbers live
in `[pipeline]` in `pipeline.toml`.

## What a restore does

A restore is a full rollback with no refund. The factory frame is replaced by
the checkpoint copy: belts, machines, packets, deliveries, demands, chapter,
owned chunks, and chunk and core pledges. Coins spent after the checkpoint are
not returned. Two things are kept from the current frame:

- `spentByUserId`: the spend ranking. Those coins really were spent.
- `collaborators`.

The tick keeps moving forward (clients drop frames with an older tick), and core
`lastIntakeTick` values are shifted to match. The spend counter resets.

## Proposals and agreement

- Proposal types: `ban` (suspend a member, never the owner) and `restore`
  (target is a checkpoint id). At most one pending proposal of each type.
- Proposers need at least one contribution (the owner is exempt).
- **Contributors** (at least one contribution, not suspended) can agree with
  `POST /api/rooms/:id/proposals/:proposalId/support`. The proposer agrees on
  creation. A ban target does not count and cannot agree.
- Every proposal shows `tally`: agreements, eligible contributors, and the
  majority line (`floor(voters / 2) + 1`).

## Who decides

Two room settings choose this, both **off** by default. They can be set when the
room is created, and the owner can change them later on the Decisões page
(`POST /api/rooms/:id/settings` with a reason).

| Setting | Off (default) | On |
| --- | --- | --- |
| `restoreByMajority` | The owner sees the agreement count and accepts or rejects. An owner's own proposal is accepted at once. | The proposal passes as soon as agreements reach the majority line. |
| `banByMajority` | Same, for suspensions. | Same, for suspensions. |

In majority mode the owner counts as one contributor and cannot accept on their
own, but can still reject a pending proposal so a stuck one does not block new
proposals. Proposals do not expire.

## History events

`snapshot` (with `kind`), `proposal`, `proposal-support`, `majority-decision`,
`bdfl-decision`, `restore`, and `ban` are recorded through `HistoryService`.
