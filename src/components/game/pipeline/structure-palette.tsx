import type { PipelineFrame, PipelineRules } from './model/frame'
import {
  getStructure,
  hotkeyForStructureIndex,
  listPlaceableStructures,
} from './structures'
import { CoinIcon } from '../coin-icon'
import styles from '../game-shell.module.css'

function structurePriceLabel(
  id: string,
  rules: PipelineRules | null,
  sandbox: boolean,
): { amount: number | null; text: string } | null {
  if (!rules) return null
  if (sandbox) return { amount: null, text: 'grátis' }
  switch (id) {
    case 'belt':
      return { amount: rules.beltCost, text: ' / célula' }
    case 'fast_belt':
      return { amount: rules.fastBeltCost, text: ' / célula' }
    case 'splitter':
      return { amount: rules.splitterCost, text: '' }
    case 'trashcan':
      return { amount: rules.trashcanCost, text: '' }
    case 'combiner_2':
    case 'combiner_3':
      return { amount: rules.combinerCost, text: '' }
    case 'tunnel':
      return { amount: rules.tunnelCost, text: ' / par' }
    case 'fast_tunnel':
      return { amount: rules.fastTunnelCost, text: ' / par' }
    default:
      return null
  }
}

type Props = {
  frame: PipelineFrame | null
  rules: PipelineRules | null
  selectedStructureId: string
  onSelectStructure: (id: string) => void
  onRotate?: () => void
}

/** Placeable structures from the registry, plus create/delete mode. */
export function StructurePalette({
  frame,
  rules,
  selectedStructureId,
  onSelectStructure,
  onRotate,
}: Props) {
  const sandbox = frame?.sandbox === true
  const structures = listPlaceableStructures(sandbox)
  const canRotate = Boolean(getStructure(selectedStructureId)?.rotate)

  return (
    <section className={styles.structurePalette} aria-labelledby="structure-palette-heading">
      <h2 id="structure-palette-heading" className={styles.sidebarSectionTitle}>
        Estruturas
      </h2>
      <div className={styles.structureList} role="list">
        {structures.map((structure, index) => {
          const selected = structure.id === selectedStructureId
          const price = structurePriceLabel(structure.id, rules, sandbox)
          const hotkey = hotkeyForStructureIndex(index)
          return (
            <button
              key={structure.id}
              type="button"
              className={styles.structureItem}
              aria-pressed={selected}
              aria-keyshortcuts={hotkey ?? undefined}
              role="listitem"
              title={hotkey ? `${structure.label} — ${hotkey}` : structure.label}
              onClick={() => onSelectStructure(structure.id)}
            >
              {hotkey ? (
                <kbd className={styles.structureHotkey} aria-hidden>
                  {hotkey}
                </kbd>
              ) : null}
              <span
                className={styles.structureIcon}
                style={{
                  maskImage: `url(${structure.iconSrc})`,
                  WebkitMaskImage: `url(${structure.iconSrc})`,
                }}
                aria-hidden
              />
              <span className={styles.structureLabel}>{structure.label}</span>
              {price ? (
                <span className={styles.structureCost}>
                  {price.amount != null ? (
                    <>
                      {price.amount}
                      <CoinIcon />
                    </>
                  ) : null}
                  {price.text}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className={styles.editModeRow} role="group" aria-label="Modo de edição">
        <button
          type="button"
          className={styles.editModeButton}
          disabled={!canRotate}
          aria-keyshortcuts="R"
          title="Girar (R)"
          onClick={() => onRotate?.()}
        >
          Girar
          <kbd className={styles.editModeHotkey}>R</kbd>
        </button>
      </div>
      <p className={styles.editModeHints}>
        <span>Botão direito apaga · botão do meio ou Shift arrasta o mapa</span>
      </p>
    </section>
  )
}
