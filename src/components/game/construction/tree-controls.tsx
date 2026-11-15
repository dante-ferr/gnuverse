'use client'

import type { TreeNode, Tower, User, Wallet, TreeFrame } from '../model/types'
import styles from '../tower-game.module.css'

type TreeControlsProps = {
  user: User | null
  wallet: Wallet | null
  tower: Tower | null
  frame: TreeFrame
  selected: TreeNode | null
  growFrom: string | null
  busy: boolean
  isBanned: boolean
  onStartGrow: () => void
  onCancelGrow: () => void
  onLeaf: () => void
  onFortify: () => void
  onPrune: () => void
}

export function TreeControls({
  user,
  wallet,
  tower,
  frame,
  selected,
  growFrom,
  busy,
  isBanned,
  onStartGrow,
  onCancelGrow,
  onLeaf,
  onFortify,
  onPrune,
}: TreeControlsProps) {
  const locked = frame.turn.phase === 'physics' || frame.outcome !== 'playing'
  const canAct = Boolean(user && wallet && tower && !isBanned && !busy && !locked)
  return (
    <section className={styles.controls} aria-label="Ações na árvore">
      <p>
        Moedas: {wallet?.balance ?? '—'} · Energia: {frame.energy} · Fase:{' '}
        {frame.turn.phase}
        {frame.phaseRemainingMs
          ? ` (${Math.ceil(frame.phaseRemainingMs / 1000)}s)`
          : ''}
      </p>
      {selected && (
        <p>
          Nó {selected.id.slice(0, 8)} · {selected.authorName}
        </p>
      )}
      {!user && <p>Entre na conta para agir.</p>}
      <div className={styles.controlRow}>
        <button type="button" disabled={!canAct || !selected} onClick={onStartGrow}>
          Crescer (1)
        </button>
        <button type="button" disabled={!canAct || !selected} onClick={onLeaf}>
          Folha (1)
        </button>
        <button type="button" disabled={!canAct || !selected} onClick={onFortify}>
          Fortificar (2)
        </button>
        <button type="button" disabled={!canAct || !selected} onClick={onPrune}>
          Podar (1)
        </button>
        {growFrom && (
          <button type="button" onClick={onCancelGrow}>
            Cancelar traço
          </button>
        )}
      </div>
    </section>
  )
}