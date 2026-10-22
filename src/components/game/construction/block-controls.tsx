'use client'

import { BLOCKS, COLORS } from '../model/block-catalog'
import type { BlockKind, Snapshot, Tower, User, Wallet } from '../model/types'
import styles from '../tower-game.module.css'

export type BlockControlsProps = {
  kind: BlockKind
  onKindChange: (kind: BlockKind) => void
  color: string
  onColorChange: (color: string) => void
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
  settled: boolean
  onPlace: () => void
}

export function BlockControls({
  kind,
  onKindChange,
  color,
  onColorChange,
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
  settled,
  onPlace,
}: BlockControlsProps) {
  return (
    <aside className={styles.builder}>
      <p className={styles.eyebrow}>Sua contribuição</p>
      <h2>Encontre o equilíbrio.</h2>
      <p>Escolha uma peça e encontre seu lugar na construção.</p>
      <fieldset>
        <legend>01 / A peça</legend>
        <div className={styles.shapes}>
          {(Object.keys(BLOCKS) as BlockKind[]).map((value) => (
            <button
              key={value}
              className={kind === value ? styles.selected : ''}
              onClick={() => onKindChange(value)}
              aria-pressed={kind === value}
            >
              <span
                style={{
                  width: BLOCKS[value].width / 2.5,
                  height: BLOCKS[value].height / 2.5,
                }}
              />
              {BLOCKS[value].label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>02 / A cor</legend>
        <div className={styles.colors}>
          {COLORS.map((value, index) => (
            <button
              key={value}
              aria-label={['Violeta', 'Ocre', 'Verde', 'Rosa', 'Azul'][index]}
              aria-pressed={color === value}
              onClick={() => onColorChange(value)}
              style={{ background: value }}
              className={color === value ? styles.colorSelected : ''}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>03 / O ponto de partida</legend>
        <label className={styles.slider}>
          Horizontal <output>{x}</output>
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
        <span>Custo desta contribuição</span>
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
                : !settled
                  ? 'Aguardando o equilíbrio…'
                  : 'Lançar bloco ↓'}
      </button>
      {user && tower && wallet && wallet.balance < tower.cost && (
        <small>Saldo insuficiente. Aguarde a próxima moeda.</small>
      )}
      <small>
        O servidor valida cada lançamento. Quedas também fazem parte da
        construção.
      </small>
    </aside>
  )
}
