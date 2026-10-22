'use client'

import { BLOCKS } from '../model/block-catalog'
import type {
  BlockKind,
  Snapshot,
  Tower,
  User,
  Wallet,
  WindState,
} from '../model/types'
import styles from '../tower-game.module.css'
import { BlockGlyph } from './block-shapes'

export type BlockControlsProps = {
  kind: BlockKind
  onKindChange: (kind: BlockKind) => void
  x: number
  y: number
  angle: number
  onXChange: (x: number) => void
  onYChange: (y: number) => void
  onAngleChange: (angle: number) => void
  canPlace: boolean
  busy: boolean
  user: User | null
  wallet: Wallet | null
  tower: Tower | null
  isBanned: boolean
  preview: Snapshot | null
  checkpointPending?: boolean
  cooldownRemainingMs?: number
  blocksUntilCheckpoint?: number
  wind?: WindState | null
  onPlace: () => void
}

export function BlockControls({
  kind,
  onKindChange,
  x,
  y,
  angle,
  onXChange,
  onYChange,
  onAngleChange,
  canPlace,
  busy,
  user,
  wallet,
  tower,
  isBanned,
  preview,
  checkpointPending,
  cooldownRemainingMs = 0,
  blocksUntilCheckpoint,
  wind,
  onPlace,
}: BlockControlsProps) {
  const windLabel =
    wind?.phase === 'pending'
      ? 'Vento em breve'
      : wind?.phase === 'active'
        ? 'Ventania'
        : wind?.phase === 'settling'
          ? 'Estabilizando'
          : null

  return (
    <aside className={styles.builder}>
      <h2>Construir</h2>
      <fieldset>
        <legend>Peça</legend>
        <div className={styles.shapes}>
          {(Object.keys(BLOCKS) as BlockKind[]).map((value) => (
            <button
              key={value}
              className={kind === value ? styles.selected : ''}
              onClick={() => onKindChange(value)}
              aria-pressed={kind === value}
            >
              <svg
                aria-hidden="true"
                width={BLOCKS[value].width / 2.5}
                height={BLOCKS[value].height / 2.5}
                viewBox={`${-BLOCKS[value].width / 2 - 2} ${-BLOCKS[value].height / 2 - 2} ${BLOCKS[value].width + 4} ${BLOCKS[value].height + 4}`}
              >
                <BlockGlyph kind={value} />
              </svg>
              {BLOCKS[value].label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Posição</legend>
        <label className={styles.slider}>
          X <output>{x}</output>
          <input
            type="range"
            aria-label="Posição horizontal"
            min="70"
            max="930"
            value={x}
            onChange={(event) => onXChange(Number(event.target.value))}
          />
        </label>
        <label className={styles.slider}>
          Altura de lançamento <output>{740 - y}</output>
          <input
            type="range"
            aria-label="Altura de lançamento"
            min="70"
            max="680"
            value={740 - y}
            onChange={(event) => onYChange(740 - Number(event.target.value))}
          />
        </label>
        <label className={styles.slider}>
          Rotação <output>{angle}°</output>
          <input
            type="range"
            aria-label="Rotação"
            min="-90"
            max="90"
            step="5"
            value={angle}
            onChange={(event) => onAngleChange(Number(event.target.value))}
          />
        </label>
      </fieldset>
      <div className={styles.cost}>
        <span>Custo</span>
        <strong>
          {tower?.cost ?? '—'} {tower?.cost === 1 ? 'moeda' : 'moedas'}
        </strong>
      </div>
      <button className={styles.launch} disabled={!canPlace} onClick={onPlace}>
        {busy
          ? 'Enviando…'
          : !user
            ? 'Entre para construir'
            : preview
              ? 'Volte à torre ao vivo'
              : isBanned
                ? 'Participação suspensa'
                : windLabel ||
                  (checkpointPending ? 'Aguardando checkpoint…'
                    : cooldownRemainingMs > 0 ? `Aguarde ${(cooldownRemainingMs / 1000).toFixed(1)}s`
                    : 'Lançar bloco ↓')}
      </button>
      {tower && (
        <small role="status">
          {checkpointPending
            ? 'Aguardando a estabilização para salvar o checkpoint.'
            : `Próximo checkpoint em ${blocksUntilCheckpoint ?? tower.checkpointEveryBlocks} blocos.`}
        </small>
      )}
      {user && tower && wallet && wallet.balance < tower.cost && (
        <small>Saldo insuficiente.</small>
      )}
    </aside>
  )
}
