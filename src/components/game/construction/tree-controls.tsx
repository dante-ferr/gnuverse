'use client'

import type { TreeRules } from '../../../../game-server/config/load-game-config.ts'
import type { TreeNode, Tower, User, Wallet, TreeFrame } from '../model/types'
import styles from '../tower-game.module.css'

type TreeControlsProps = {
  user: User | null
  wallet: Wallet | null
  tower: Tower | null
  frame: TreeFrame
  selected: TreeNode | null
  treeRules: TreeRules
  busy: boolean
  isBanned: boolean
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
  treeRules,
  busy,
  isBanned,
  onLeaf,
  onFortify,
  onPrune,
}: TreeControlsProps) {
  const locked = frame.turn.phase === 'physics' || frame.outcome !== 'playing'
  const canAct = Boolean(user && wallet && tower && !isBanned && !busy && !locked)
  return (
    <section className={styles.controls} aria-label="Ações na árvore">
      <p className={styles.controlsMeta}>
        Moedas: {wallet?.balance ?? '—'} · Energia: {frame.energy}
      </p>
      <p className={styles.controlsHint}>
        Clique num galho e no destino para crescer. Role ou belisque para dar zoom; WASD ou arraste para mover.
      </p>
      {selected && (
        <p className={styles.controlsMeta}>
          Nó {selected.id.slice(0, 8)} · {selected.authorName}
        </p>
      )}
      {!user && <p className={styles.controlsMeta}>Entre na conta para agir.</p>}
      <div className={styles.actionButtons}>
        <button type="button" className={styles.gameAction} disabled={!canAct || !selected} onClick={onLeaf}>
          Folha ({treeRules.costLeaf})
        </button>
        <button type="button" className={styles.gameAction} disabled={!canAct || !selected} onClick={onFortify}>
          Fortificar ({treeRules.costFortify})
        </button>
        <button type="button" className={styles.gameAction} disabled={!canAct || !selected} onClick={onPrune}>
          Podar ({treeRules.costPrune})
        </button>
      </div>
    </section>
  )
}